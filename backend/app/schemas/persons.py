from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class UpdateProfileRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    dob: date
    sex: Literal["male", "female"]
    height_cm: float = Field(gt=0, le=300)
    weight_kg: float = Field(gt=0, le=500)
