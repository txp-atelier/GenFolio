"""Turns health records into embedded text chunks for RAG retrieval, stored
via LangChain's PGVector store (app.core.vector_store). Embeddings run via
Hugging Face's hosted Inference API (sentence-transformers/all-MiniLM-L6-v2,
through langchain_huggingface's HuggingFaceEndpointEmbeddings) rather than
locally — record content is sent there to be embedded, same as it's already
sent to Groq's hosted API to generate chat answers."""

import logging
import uuid

from app.core.vector_store import get_vector_store
from app.models.health_record import HealthRecord
from app.models.person import Person

logger = logging.getLogger(__name__)


def build_embedding_content(person: Person, record: HealthRecord) -> str:
    """A neutral, factual description of the record — no diagnostic framing,
    just what was recorded. Relationship-to-asker is computed separately at
    query time (see rag_service), never baked in here, since it's relative
    to whoever's asking."""
    v = record.value
    name = f"{person.first_name} {person.last_name}"
    date = record.recorded_at.date().isoformat()

    if record.category == "blood_sugar":
        context = f" ({str(v['context']).replace('_', ' ')})" if v.get("context") else ""
        return f"{name} recorded a blood sugar level of {v['value']} {v['unit']}{context} on {date}."

    if record.category == "blood_pressure":
        return f"{name} recorded blood pressure {v['systolic']}/{v['diastolic']} {v['unit']} on {date}."

    if record.category == "cholesterol":
        parts = [f"{k} {v[k]}" for k in ("total", "hdl", "ldl", "triglycerides") if v.get(k) is not None]
        detail = ", ".join(parts) if parts else "no values recorded"
        return f"{name} recorded cholesterol levels ({detail}) on {date}."

    if record.category == "condition":
        diagnosed = f", diagnosed {v['diagnosed_date']}" if v.get("diagnosed_date") else ""
        notes = f" Notes: {v['notes']}" if v.get("notes") else ""
        return f"{name} has been diagnosed with {v['name']}{diagnosed}.{notes}"

    # "other"
    notes = f" {v['notes']}" if v.get("notes") else ""
    return f"{name} has a recorded health note: {v.get('name', '')}.{notes}"


async def sync_health_record_embedding(person: Person, record: HealthRecord) -> None:
    """Re-embeds and (up)stores the record's chunk, keyed by the health
    record's own id so re-syncing on update replaces rather than
    duplicates."""
    content = build_embedding_content(person, record)
    doc_id = str(record.id)
    vector_store = get_vector_store()

    await vector_store.adelete(ids=[doc_id])
    await vector_store.aadd_texts(
        texts=[content],
        metadatas=[
            {
                "family_id": str(person.family_id),
                "person_id": str(person.id),
                "source_type": "health_record",
                "source_id": doc_id,
            }
        ],
        ids=[doc_id],
    )


async def delete_health_record_embedding(record_id: uuid.UUID) -> None:
    await get_vector_store().adelete(ids=[str(record_id)])


# --- Background-task wrappers ---------------------------------------------
# The record itself is already committed to Postgres by the time these run
# (see health_record_service) — the embedding is a retrieval aid for the RAG
# chatbot, not part of what makes a save succeed. Scheduled via FastAPI's
# BackgroundTasks (see app.api.health_records) so a slow or unreachable HF
# endpoint delays the chatbot's index, never the user's save request. Each
# wrapper swallows its own failure (logged, not raised) since there's no
# request left by the time a background task runs to report an error to.


async def sync_health_record_embedding_background(person: Person, record: HealthRecord) -> None:
    try:
        await sync_health_record_embedding(person, record)
    except Exception:
        logger.exception("Failed to sync embedding for health record %s", record.id)


async def delete_health_record_embedding_background(record_id: uuid.UUID) -> None:
    try:
        await delete_health_record_embedding(record_id)
    except Exception:
        logger.exception("Failed to delete embedding for health record %s", record_id)
