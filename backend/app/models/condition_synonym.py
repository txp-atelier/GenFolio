import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ConditionSynonym(Base):
    """Maps a colloquial term ("bald", "sugar disease") to the canonical
    condition name used in health records ("Androgenetic Alopecia", "Type 2
    Diabetes Mellitus"), so a chat question can be matched to records that
    never use the same wording. See rag_service.normalize_query."""

    __tablename__ = "condition_synonyms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    alias: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    canonical_name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
