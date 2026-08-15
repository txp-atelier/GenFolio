"""The RAG pipeline: normalize the question -> retrieve scoped, relevant
health-record chunks via the LangChain vector store -> label each match with
its relationship to the asking user -> generate a grounded answer with Groq.

Retrieval is scoped to blood relatives only (never in-laws) — heredity is
genetic, not by marriage. See app.services.relationship_service for how that
set is computed."""

import uuid
from dataclasses import dataclass

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.vector_store import get_vector_store
from app.models.condition_synonym import ConditionSynonym
from app.models.health_record import HealthRecord
from app.models.person import Person
from app.services.relationship_service import (
    blood_relation,
    describe_blood_relation,
    load_family_graph,
    load_family_persons,
)

SYSTEM_PROMPT = """You are a family health history assistant. You help users spot \
patterns in health conditions across their own family by referencing recorded \
health data from their blood relatives.

Rules:
- Only use the family health records given to you below. Never invent conditions, \
relatives, or details that aren't present in them.
- This is informational family-history pattern-matching, NOT a medical diagnosis. \
Never state or imply a diagnosis. Encourage the user to consult a healthcare \
professional for actual medical advice.
- When you reference a relative, name them and state their relationship to the \
user exactly as given (e.g. "your mother", "your maternal grandfather").
- If no relevant family health records were found, say so plainly rather than \
guessing or generalizing.
- Be concise and direct."""

_PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", SYSTEM_PROMPT),
        ("human", "Family health records:\n{context}\n\nQuestion: {question}"),
    ]
)

_llm: ChatGroq | None = None


def _get_llm() -> ChatGroq:
    global _llm
    if _llm is None:
        _llm = ChatGroq(model=settings.groq_model, api_key=settings.groq_api_key, temperature=0.3)
    return _llm


@dataclass
class ChatAnswer:
    answer: str
    cited_relatives: list[dict]


async def normalize_query(db: AsyncSession, question: str) -> str:
    """Expands the question with any matching canonical condition names
    (e.g. "why am I bald" -> also mentions "Androgenetic Alopecia") so
    retrieval isn't solely dependent on the embedding model bridging
    colloquial and clinical wording on its own."""
    result = await db.execute(select(ConditionSynonym))
    synonyms = result.scalars().all()
    lowered = question.lower()
    matched = {s.canonical_name for s in synonyms if s.alias in lowered}
    if not matched:
        return question
    return f"{question} ({', '.join(sorted(matched))})"


async def _drop_private_records(
    db: AsyncSession, ego_person_id: uuid.UUID, results: list[tuple]
) -> list[tuple]:
    """Excludes matches whose underlying health record is marked private
    (visible_to_family=False) and doesn't belong to the asker themselves.
    Checked against the health_records table directly — the source of
    truth — rather than embedding metadata, so toggling visibility takes
    effect immediately without needing every embedding re-synced."""
    source_ids: list[uuid.UUID] = []
    for doc, _distance in results:
        try:
            source_ids.append(uuid.UUID(doc.metadata["source_id"]))
        except (KeyError, ValueError, TypeError):
            continue
    if not source_ids:
        return results

    rows = await db.execute(
        select(HealthRecord.id, HealthRecord.person_id, HealthRecord.visible_to_family).where(
            HealthRecord.id.in_(source_ids)
        )
    )
    visibility = {row.id: (row.person_id, row.visible_to_family) for row in rows}

    filtered = []
    for doc, distance in results:
        try:
            source_id = uuid.UUID(doc.metadata["source_id"])
        except (KeyError, ValueError, TypeError):
            continue
        info = visibility.get(source_id)
        if info is None:
            continue  # record was deleted since it was embedded
        person_id, visible_to_family = info
        if person_id != ego_person_id and not visible_to_family:
            continue
        filtered.append((doc, distance))
    return filtered


async def generate_answer(question: str, context_items: list[dict]) -> str:
    if context_items:
        context_text = "\n".join(
            f"- {item['relative_name']} ({item['relationship']}): {item['content']}"
            for item in context_items
        )
    else:
        context_text = "No matching family health records were found for this question."

    chain = _PROMPT | _get_llm() | StrOutputParser()
    return await chain.ainvoke({"context": context_text, "question": question})


async def answer_question(db: AsyncSession, ego_person: Person, question: str) -> ChatAnswer:
    graph = await load_family_graph(db, ego_person.family_id)
    persons = await load_family_persons(db, ego_person.family_id)

    candidate_ids = [str(ego_person.id)]
    for pid in persons:
        if pid != ego_person.id and blood_relation(graph, ego_person.id, pid) is not None:
            candidate_ids.append(str(pid))

    query_text = await normalize_query(db, question)

    vector_store = get_vector_store()
    results = await vector_store.asimilarity_search_with_score(
        query_text,
        k=settings.rag_top_k,
        filter={
            "family_id": {"$eq": str(ego_person.family_id)},
            "person_id": {"$in": candidate_ids},
        },
    )
    results = await _drop_private_records(db, ego_person.id, results)

    context_items: list[dict] = []
    cited_relatives: list[dict] = []
    seen_people: set[uuid.UUID] = set()

    for doc, distance in results:
        if distance > settings.rag_max_distance:
            continue

        person_id = uuid.UUID(doc.metadata["person_id"])
        person = persons.get(person_id)
        if person is None:
            continue

        if person_id == ego_person.id:
            relationship = "yourself"
        else:
            rel = blood_relation(graph, ego_person.id, person_id)
            relationship = describe_blood_relation(*rel, person.sex) if rel else "relative"

        context_items.append(
            {
                "relative_name": f"{person.first_name} {person.last_name}",
                "relationship": relationship,
                "content": doc.page_content,
            }
        )

        if person_id not in seen_people:
            cited_relatives.append(
                {
                    "person_id": person_id,
                    "first_name": person.first_name,
                    "last_name": person.last_name,
                    "relationship": relationship,
                }
            )
            seen_people.add(person_id)

    answer = await generate_answer(question, context_items)

    # Retrieval can surface weakly-relevant matches (e.g. asking about
    # cancer when the only records on file are diabetes/baldness) that
    # clear the distance threshold without being truly relevant. The system
    # prompt instructs the model to name whoever it actually draws on, so
    # cross-checking cited_relatives against the answer text keeps it
    # honest even when raw retrieval is looser than ideal.
    answer_lower = answer.lower()
    cited_relatives = [r for r in cited_relatives if r["first_name"].lower() in answer_lower]

    return ChatAnswer(answer=answer, cited_relatives=cited_relatives)
