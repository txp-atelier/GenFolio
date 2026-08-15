import uuid
from datetime import datetime, timezone

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.health_record import HealthRecord
from app.models.person import Person
from app.schemas.health_record_values import VALUE_SCHEMAS_BY_CATEGORY
from app.services.embedding_service import delete_health_record_embedding, sync_health_record_embedding


class InvalidHealthRecordValueError(Exception):
    def __init__(self, errors: list[dict]):
        self.errors = errors
        super().__init__("Invalid value for this health record category")


class HealthRecordNotFoundError(Exception):
    pass


def validate_value(category: str, value: dict) -> dict:
    """Parses `value` against the Pydantic model for `category` and returns
    a JSON-safe dict of the normalized result. Raises
    InvalidHealthRecordValueError (caught by the API layer as a 422) if it
    doesn't match — e.g. a blood_pressure record missing `diastolic`."""
    schema = VALUE_SCHEMAS_BY_CATEGORY[category]
    try:
        parsed = schema.model_validate(value)
    except ValidationError as exc:
        raise InvalidHealthRecordValueError(exc.errors()) from exc
    return parsed.model_dump(mode="json")


async def create_health_record(
    db: AsyncSession,
    person: Person,
    category: str,
    value: dict,
    recorded_at: datetime | None,
    visible_to_family: bool = True,
) -> HealthRecord:
    record = HealthRecord(
        person_id=person.id,
        category=category,
        value=validate_value(category, value),
        recorded_at=recorded_at or datetime.now(timezone.utc),
        visible_to_family=visible_to_family,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    # The embedding store is a separate connection (LangChain's PGVector
    # requires psycopg3, not our asyncpg engine) — not part of this
    # transaction. Sync it only after the record itself is safely
    # committed, so we never embed something that didn't actually save.
    await sync_health_record_embedding(person, record)
    return record


async def list_health_records(db: AsyncSession, person_id: uuid.UUID) -> list[HealthRecord]:
    result = await db.execute(
        select(HealthRecord)
        .where(HealthRecord.person_id == person_id)
        .order_by(HealthRecord.recorded_at.desc())
    )
    return list(result.scalars().all())


async def get_own_health_record(
    db: AsyncSession, person_id: uuid.UUID, record_id: uuid.UUID
) -> HealthRecord:
    result = await db.execute(
        select(HealthRecord).where(
            HealthRecord.id == record_id, HealthRecord.person_id == person_id
        )
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise HealthRecordNotFoundError()
    return record


async def update_health_record(
    db: AsyncSession,
    person: Person,
    record_id: uuid.UUID,
    value: dict | None,
    recorded_at: datetime | None,
    visible_to_family: bool | None,
) -> HealthRecord:
    record = await get_own_health_record(db, person.id, record_id)

    content_changed = value is not None or recorded_at is not None

    if value is not None:
        record.value = validate_value(record.category, value)
    if recorded_at is not None:
        record.recorded_at = recorded_at
    if visible_to_family is not None:
        record.visible_to_family = visible_to_family

    await db.commit()
    await db.refresh(record)

    if content_changed:
        await sync_health_record_embedding(person, record)
    return record


async def delete_health_record(db: AsyncSession, person_id: uuid.UUID, record_id: uuid.UUID) -> None:
    record = await get_own_health_record(db, person_id, record_id)
    record_id_copy = record.id
    await db.delete(record)
    await db.commit()
    await delete_health_record_embedding(record_id_copy)
