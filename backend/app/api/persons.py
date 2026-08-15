from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.auth import MeResponse
from app.schemas.persons import UpdateProfileRequest
from app.schemas.relationships import FamilyGraphResponse, PersonNode, RelativeOut, TreeResponse
from app.services.auth_service import build_me_response, get_person_by_user_id
from app.services.profile_picture_service import (
    MAX_PROFILE_PICTURE_BYTES,
    CloudinaryNotConfiguredError,
    upload_profile_picture,
)
from app.services.relationship_service import (
    build_relative_list,
    load_family_graph,
    load_family_persons,
)

router = APIRouter(prefix="/persons", tags=["persons"])


@router.patch("/me", response_model=MeResponse)
async def update_my_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MeResponse:
    person = await get_person_by_user_id(db, current_user.id)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No person record for this user")

    # exclude_unset (not exclude_none) so omitted fields are left untouched
    # while an explicit null still clears that field.
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(person, field, value)

    await db.commit()
    await db.refresh(person)
    return await build_me_response(db, current_user, person)


@router.post("/me/profile-picture", response_model=MeResponse)
async def upload_my_profile_picture(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MeResponse:
    person = await get_person_by_user_id(db, current_user.id)
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No person record for this user")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "File must be an image")

    contents = await file.read()
    if len(contents) > MAX_PROFILE_PICTURE_BYTES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Image must be smaller than 5MB")

    try:
        url = await upload_profile_picture(person.family_id, person.id, contents)
    except CloudinaryNotConfiguredError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Image uploads aren't configured yet"
        ) from exc

    person.profile_picture_url = url
    await db.commit()
    await db.refresh(person)
    return await build_me_response(db, current_user, person)


@router.get("/me/tree", response_model=TreeResponse)
async def get_my_tree(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TreeResponse:
    ego = await get_person_by_user_id(db, current_user.id)
    if ego is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No person record for this user")

    graph = await load_family_graph(db, ego.family_id)
    persons = await load_family_persons(db, ego.family_id)
    relatives = build_relative_list(graph, persons, ego.id)

    return TreeResponse(
        ego=RelativeOut(
            person_id=ego.id,
            first_name=ego.first_name,
            last_name=ego.last_name,
            is_claimed=ego.is_claimed,
            relationship="self",
            category="self",
        ),
        relatives=[
            RelativeOut(
                person_id=r.person.id,
                first_name=r.person.first_name,
                last_name=r.person.last_name,
                is_claimed=r.person.is_claimed,
                relationship=r.relationship,
                category=r.category,
            )
            for r in relatives
        ],
    )


@router.get("/me/family-graph", response_model=FamilyGraphResponse)
async def get_my_family_graph(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FamilyGraphResponse:
    ego = await get_person_by_user_id(db, current_user.id)
    if ego is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No person record for this user")

    graph = await load_family_graph(db, ego.family_id)
    persons = await load_family_persons(db, ego.family_id)
    relatives = build_relative_list(graph, persons, ego.id)
    labels_by_id = {r.person.id: (r.relationship, r.category) for r in relatives}

    nodes = []
    for person_id, person in persons.items():
        if person_id == ego.id:
            relationship, category = "self", "self"
        else:
            relationship, category = labels_by_id.get(person_id, ("relative", "unknown"))
        nodes.append(
            PersonNode(
                person_id=person.id,
                first_name=person.first_name,
                last_name=person.last_name,
                sex=person.sex,
                is_claimed=person.is_claimed,
                is_self=person.id == ego.id,
                profile_picture_url=person.profile_picture_url,
                relationship=relationship,
                category=category,
                parent_ids=sorted(graph.parents_of.get(person_id, ())),
                child_ids=sorted(graph.children_of.get(person_id, ())),
                spouse_ids=sorted(graph.spouses_of.get(person_id, ())),
            )
        )

    return FamilyGraphResponse(ego_person_id=ego.id, persons=nodes)
