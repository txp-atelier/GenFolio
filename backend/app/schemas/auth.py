import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    family_name: str = Field(min_length=1, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr

    model_config = {"from_attributes": True}


class MeResponse(BaseModel):
    user: UserOut
    person_id: uuid.UUID
    family_id: uuid.UUID
    family_name: str
    first_name: str
    last_name: str
    dob: date | None
    sex: Literal["male", "female"] | None
    height_cm: float | None
    weight_kg: float | None
    profile_picture_url: str | None


class PasswordResetRequestIn(BaseModel):
    email: EmailStr


class PasswordResetRequestOut(BaseModel):
    message: str
    # Populated outside production only, since no email provider is wired up
    # yet — see FRONTEND_URL / settings.environment.
    reset_token: str | None = None
    reset_url: str | None = None


class PasswordResetConfirmIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=72)
