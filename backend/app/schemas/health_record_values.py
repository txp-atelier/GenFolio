"""One Pydantic model per health_records.category, used to validate the
free-form `value` JSON before it's persisted. Kept separate from the
request/response schemas since these describe the *shape of the data*,
not the API contract around it."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class BloodSugarValue(BaseModel):
    value: float = Field(gt=0, description="Blood glucose reading")
    unit: Literal["mg/dL", "mmol/L"] = "mg/dL"
    context: Literal["fasting", "post_meal", "random"] | None = None


class BloodPressureValue(BaseModel):
    systolic: int = Field(gt=0)
    diastolic: int = Field(gt=0)
    unit: Literal["mmHg"] = "mmHg"


class CholesterolValue(BaseModel):
    total: float | None = Field(default=None, gt=0)
    hdl: float | None = Field(default=None, gt=0)
    ldl: float | None = Field(default=None, gt=0)
    triglycerides: float | None = Field(default=None, gt=0)
    unit: Literal["mg/dL", "mmol/L"] = "mg/dL"


class ConditionValue(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    diagnosed_date: date | None = None
    notes: str | None = Field(default=None, max_length=2000)


class OtherValue(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)


VALUE_SCHEMAS_BY_CATEGORY: dict[str, type[BaseModel]] = {
    "blood_sugar": BloodSugarValue,
    "blood_pressure": BloodPressureValue,
    "cholesterol": CholesterolValue,
    "condition": ConditionValue,
    "other": OtherValue,
}
