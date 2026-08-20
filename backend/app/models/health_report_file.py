import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class HealthReportFile(Base):
    __tablename__ = "health_report_files"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    person_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("persons.id"), nullable=False, index=True
    )
    # User-facing name — defaults to the original filename but can be renamed
    # without touching the underlying Cloudinary asset.
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    # Needed to delete (or re-target) the Cloudinary asset later — the URL
    # alone isn't enough to call the Admin API.
    cloudinary_public_id: Mapped[str] = mapped_column(String(300), nullable=False)
    # "image" | "raw" — Cloudinary's own resource_type, kept alongside the
    # public_id since deleting an asset requires both.
    cloudinary_resource_type: Mapped[str] = mapped_column(String(20), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
