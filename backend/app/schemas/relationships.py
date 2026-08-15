import uuid
from typing import Literal

from pydantic import BaseModel


class RelativeOut(BaseModel):
    person_id: uuid.UUID
    first_name: str
    last_name: str
    is_claimed: bool
    relationship: str
    category: Literal["blood", "spouse", "in_law", "self"]


class TreeResponse(BaseModel):
    ego: RelativeOut
    relatives: list[RelativeOut]


class PersonNode(BaseModel):
    """One person plus their direct PARENT_OF/SPOUSE_OF edges — enough for the
    frontend to lay out an actual genealogical tree (couples + generations),
    rather than the ego-relative flat list above."""

    person_id: uuid.UUID
    first_name: str
    last_name: str
    sex: Literal["male", "female"] | None
    is_claimed: bool
    is_self: bool
    profile_picture_url: str | None
    relationship: str
    category: Literal["blood", "spouse", "in_law", "self", "unknown"]
    parent_ids: list[uuid.UUID]
    child_ids: list[uuid.UUID]
    spouse_ids: list[uuid.UUID]


class FamilyGraphResponse(BaseModel):
    ego_person_id: uuid.UUID
    persons: list[PersonNode]
