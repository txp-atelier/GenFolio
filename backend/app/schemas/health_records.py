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
