from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class UpdateProfileRequest(BaseModel):
    dob: date
    sex: Literal["male", "female"]
    height_cm: float = Field(gt=0, le=300)
    weight_kg: float = Field(gt=0, le=500)
