import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.person import Person
from app.models.user import User
from app.schemas.health_records import (
    CreateHealthRecordRequest,
    HealthMatchOut,
    HealthRecordOut,
    HealthSearchResponse,
    HealthSearchResultOut,
    PersonHealthReportOut,
    UpdateHealthRecordRequest,
)
from app.services.auth_service import get_person_by_user_id
from app.services.embedding_service import (
    delete_health_record_embedding_background,
    sync_health_record_embedding_background,
)
from app.services.health_record_service import (
    HealthRecordNotFoundError,
    InvalidHealthRecordValueError,
    age_from_dob,
    create_health_record,
    delete_health_record,
    describe_numeric_value,
    find_family_health_matches,
    get_family_health_snapshots,
    get_family_member,
    latest_by_category,
    list_health_records,
    list_visible_health_records,
    parse_health_query,
    person_ids_matching_relationship,
    search_family_by_health,
    update_health_record,
)
from app.services.rag_service import find_family_members_by_query
from app.services.relationship_service import load_family_graph, load_family_persons

router = APIRouter(prefix="/health-records", tags=["health-records"])


def _safe_errors(errors: list[dict]) -> list[dict]:
    # pydantic's ValidationError.errors() can include non-JSON-safe values
    # (e.g. the offending input itself) — keep only the plain-string parts.
    return [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in errors]


async def _get_own_person(db: AsyncSession, current_user: User) -> Person:
    person = await get_person_by_user_id(db, current_user.id)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No person record for this user")
    return person


@router.post("", response_model=HealthRecordOut, status_code=status.HTTP_201_CREATED)
async def create_record(
    data: CreateHealthRecordRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HealthRecordOut:
    person = await _get_own_person(db, current_user)
    try:
        record = await create_health_record(
            db, person, data.category, data.value, data.recorded_at, data.visible_to_family
        )
    except InvalidHealthRecordValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, _safe_errors(exc.errors)) from exc
    # The record is already committed at this point — re-indexing it for the
    # RAG chatbot happens after the response goes out, so a slow or
    # unreachable embedding API delays the chatbot's index, never the save
    # itself (see app.services.embedding_service).
    background_tasks.add_task(sync_health_record_embedding_background, person, record)
    return HealthRecordOut.model_validate(record)


@router.get("", response_model=list[HealthRecordOut])
async def list_records(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[HealthRecordOut]:
    person = await _get_own_person(db, current_user)
    records = await list_health_records(db, person.id)
    return [HealthRecordOut.model_validate(r) for r in records]


@router.get("/compare", response_model=list[HealthMatchOut])
async def compare_with_family(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[HealthMatchOut]:
    person = await _get_own_person(db, current_user)
    matches = await find_family_health_matches(db, person, limit=10)
    return [
        HealthMatchOut(
            person_id=match_person.id,
            first_name=match_person.first_name,
            last_name=match_person.last_name,
            sex=match_person.sex,
            age=age_from_dob(match_person.dob),
            profile_picture_url=match_person.profile_picture_url,
            match_percentage=round(score, 1),
        )
        for match_person, score in matches
    ]


def _describe_matched_record(category: str, value: dict) -> str:
    if category in ("blood_sugar", "blood_pressure", "cholesterol"):
        return describe_numeric_value(category, None, value)
    name = value.get("name")
    return str(name) if name else "Health note on record"


@router.get("/search", response_model=HealthSearchResponse)
async def search_by_health_query(
    q: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HealthSearchResponse:
    viewer = await _get_own_person(db, current_user)
    parsed = parse_health_query(q)

    # A relationship word ("siblings with...", "who is bald" for a
    # specific side of the family) narrows either path below the same way.
    allowed_person_ids: set[uuid.UUID] | None = None
    if parsed is not None and parsed.relationship_keywords:
        graph = await load_family_graph(db, viewer.family_id)
        persons = await load_family_persons(db, viewer.family_id)
        allowed_person_ids = person_ids_matching_relationship(
            graph, persons, viewer.id, parsed.relationship_keywords
        )

    if parsed is not None:
        # An explicit vitals filter ("sugar level higher than 300", "high
        # blood pressure") — exact, no embeddings involved.
        viewer_latest = latest_by_category(await list_health_records(db, viewer.id))
        snapshots = await get_family_health_snapshots(db, viewer)
        if allowed_person_ids is not None:
            snapshots = [(person, latest) for person, latest in snapshots if person.id in allowed_person_ids]

        matches = search_family_by_health(snapshots, parsed, viewer_latest)
        return HealthSearchResponse(
            recognized=True,
            results=[
                HealthSearchResultOut(
                    person_id=person.id,
                    first_name=person.first_name,
                    last_name=person.last_name,
                    sex=person.sex,
                    age=age_from_dob(person.dob),
                    profile_picture_url=person.profile_picture_url,
                    matched_value=matched_value,
                )
                for person, matched_value in matches
            ],
        )

    # Anything else — free-text condition/disorder descriptions like
    # "who is bald" or "diabetics" — goes through the same semantic
    # retrieval the chat feature uses instead of a plain substring match,
    # so colloquial phrasing (via condition-synonym expansion) and near-
    # miss wording (via embedding similarity) both still find people. If
    # nothing clears the relevance bar, recognized comes back false and the
    # frontend falls back to its plain name filter.
    semantic_matches = await find_family_members_by_query(
        db, viewer, q, allowed_person_ids=allowed_person_ids, limit=10
    )
    if not semantic_matches:
        return HealthSearchResponse(recognized=False, results=[])

    return HealthSearchResponse(
        recognized=True,
        results=[
            HealthSearchResultOut(
                person_id=person.id,
                first_name=person.first_name,
                last_name=person.last_name,
                sex=person.sex,
                age=age_from_dob(person.dob),
                profile_picture_url=person.profile_picture_url,
                matched_value=_describe_matched_record(record.category, record.value),
            )
            for person, record, _distance in semantic_matches
        ],
    )


@router.get("/family/{person_id}", response_model=PersonHealthReportOut)
async def get_family_member_report(
    person_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PersonHealthReportOut:
    viewer = await _get_own_person(db, current_user)
    target = await get_family_member(db, viewer, person_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Person not found")

    latest = latest_by_category(await list_visible_health_records(db, person_id))
    return PersonHealthReportOut(
        person_id=target.id,
        first_name=target.first_name,
        last_name=target.last_name,
        sex=target.sex,
        age=age_from_dob(target.dob),
        profile_picture_url=target.profile_picture_url,
        blood_sugar=HealthRecordOut.model_validate(latest["blood_sugar"]) if "blood_sugar" in latest else None,
        blood_pressure=HealthRecordOut.model_validate(latest["blood_pressure"])
        if "blood_pressure" in latest
        else None,
        cholesterol=HealthRecordOut.model_validate(latest["cholesterol"]) if "cholesterol" in latest else None,
        other=HealthRecordOut.model_validate(latest["other"]) if "other" in latest else None,
    )


@router.patch("/{record_id}", response_model=HealthRecordOut)
async def update_record(
    record_id: uuid.UUID,
    data: UpdateHealthRecordRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> HealthRecordOut:
    person = await _get_own_person(db, current_user)
    try:
        record = await update_health_record(
            db, person, record_id, data.value, data.recorded_at, data.visible_to_family
        )
    except HealthRecordNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Health record not found") from exc
    except InvalidHealthRecordValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, _safe_errors(exc.errors)) from exc
    content_changed = data.value is not None or data.recorded_at is not None
    if content_changed:
        background_tasks.add_task(sync_health_record_embedding_background, person, record)
    return HealthRecordOut.model_validate(record)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_record(
    record_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    person = await _get_own_person(db, current_user)
    try:
        deleted_record_id = await delete_health_record(db, person.id, record_id)
    except HealthRecordNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Health record not found") from exc
    background_tasks.add_task(delete_health_record_embedding_background, deleted_record_id)
