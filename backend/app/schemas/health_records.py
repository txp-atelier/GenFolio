import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

HealthRecordCategory = Literal["blood_sugar", "blood_pressure", "cholesterol", "condition", "other"]


class CreateHealthRecordRequest(BaseModel):
    category: HealthRecordCategory
    value: dict[str, Any]
    recorded_at: datetime | None = None
    visible_to_family: bool = True


class UpdateHealthRecordRequest(BaseModel):
    value: dict[str, Any] | None = None
    recorded_at: datetime | None = None
    visible_to_family: bool | None = None


class HealthRecordOut(BaseModel):
    id: uuid.UUID
    category: HealthRecordCategory
    value: dict[str, Any]
    recorded_at: datetime
    visible_to_family: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class HealthMatchOut(BaseModel):
    person_id: uuid.UUID
    first_name: str
    last_name: str
    sex: Literal["male", "female"] | None
    age: int | None
    profile_picture_url: str | None
    match_percentage: float


class PersonHealthReportOut(BaseModel):
    person_id: uuid.UUID
    first_name: str
    last_name: str
    sex: Literal["male", "female"] | None
    age: int | None
    profile_picture_url: str | None
    blood_sugar: HealthRecordOut | None
    blood_pressure: HealthRecordOut | None
    cholesterol: HealthRecordOut | None
    other: HealthRecordOut | None


class HealthSearchResultOut(BaseModel):
    person_id: uuid.UUID
    first_name: str
    last_name: str
    sex: Literal["male", "female"] | None
    age: int | None
    profile_picture_url: str | None
    matched_value: str


class HealthSearchResponse(BaseModel):
    # False when the query text didn't parse as a health-criteria search at
    # all (e.g. it's just a name) — the frontend falls back to its existing
    # plain-text name filter in that case rather than showing "no results".
    recognized: bool
    results: list[HealthSearchResultOut]
