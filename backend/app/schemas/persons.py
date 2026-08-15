from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class UpdateProfileRequest(BaseModel):
    dob: date | None = None
    sex: Literal["male", "female"] | None = None
    height_cm: float | None = Field(default=None, gt=0, le=300)
    weight_kg: float | None = Field(default=None, gt=0, le=500)
