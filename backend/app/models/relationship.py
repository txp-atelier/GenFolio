import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Relationship(Base):
    """The only two canonical edge types stored. Everything else (sibling,
    grandparent, aunt/uncle, cousin, in-law) is derived at read time by
    app.services.relationship_service — see the project plan for why.

    For type="PARENT_OF": person_a_id is the parent, person_b_id is the child.
    For type="SPOUSE_OF": undirected; person_a_id/person_b_id are stored with
    person_a_id < person_b_id so the pair can't be inserted in both orders.
    """

    __tablename__ = "relationships"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    family_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("families.id"), nullable=False, index=True
    )
    person_a_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("persons.id"), nullable=False, index=True
    )
    person_b_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("persons.id"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("person_a_id", "person_b_id", "type", name="uq_relationship_edge"),
    )
