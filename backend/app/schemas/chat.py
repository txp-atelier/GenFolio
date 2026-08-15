import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class SendMessageRequest(BaseModel):
    message: str
    session_id: uuid.UUID | None = None


class CitedRelativeOut(BaseModel):
    person_id: uuid.UUID
    first_name: str
    last_name: str
    relationship: str


class SendMessageResponse(BaseModel):
    session_id: uuid.UUID
    answer: str
    cited_relatives: list[CitedRelativeOut]


class ChatMessageOut(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}
