import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class HealthReportFileOut(BaseModel):
    id: uuid.UUID
    title: str
    original_filename: str
    file_url: str
    mime_type: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class UpdateHealthReportFileRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
