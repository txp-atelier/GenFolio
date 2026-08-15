from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

RelationshipToInviter = Literal["parent", "child", "sibling", "spouse"]


class CreateInvitationRequest(BaseModel):
    relationship_to_inviter: RelationshipToInviter


class InvitationOut(BaseModel):
    token: str
    invite_url: str
    relationship_to_inviter: RelationshipToInviter
    expires_at: datetime


class InvitationPreview(BaseModel):
    family_name: str
    inviter_first_name: str
    inviter_last_name: str
    relationship_to_inviter: RelationshipToInviter
    status: str


class AcceptInvitationRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
