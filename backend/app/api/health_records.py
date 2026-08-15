import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.person import Person
from app.models.user import User
from app.schemas.health_records import (
    CreateHealthRecordRequest,
    HealthRecordOut,
    UpdateHealthRecordRequest,
)
from app.services.auth_service import get_person_by_user_id
from app.services.health_record_service import (
    HealthRecordNotFoundError,
    InvalidHealthRecordValueError,
    create_health_record,
    delete_health_record,
    list_health_records,
    update_health_record,
)

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
    return HealthRecordOut.model_validate(record)


@router.get("", response_model=list[HealthRecordOut])
async def list_records(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[HealthRecordOut]:
    person = await _get_own_person(db, current_user)
    records = await list_health_records(db, person.id)
    return [HealthRecordOut.model_validate(r) for r in records]


@router.patch("/{record_id}", response_model=HealthRecordOut)
async def update_record(
    record_id: uuid.UUID,
    data: UpdateHealthRecordRequest,
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
    return HealthRecordOut.model_validate(record)


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_record(
    record_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    person = await _get_own_person(db, current_user)
    try:
        await delete_health_record(db, person.id, record_id)
    except HealthRecordNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Health record not found") from exc
