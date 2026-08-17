import difflib
import re
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Literal

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.health_record import HealthRecord
from app.models.person import Person
from app.schemas.health_record_values import VALUE_SCHEMAS_BY_CATEGORY
from app.services.embedding_service import delete_health_record_embedding, sync_health_record_embedding
from app.services.relationship_service import FamilyGraph, build_relative_list, load_family_persons


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


async def get_family_member(db: AsyncSession, viewer: Person, person_id: uuid.UUID) -> Person | None:
    """Looks up person_id, scoped to viewer's own family — returns None for
    both "doesn't exist" and "exists but in a different family" so callers
    can't distinguish the two and probe for other families' members."""
    result = await db.execute(
        select(Person).where(Person.id == person_id, Person.family_id == viewer.family_id)
    )
    return result.scalar_one_or_none()


async def list_visible_health_records(db: AsyncSession, person_id: uuid.UUID) -> list[HealthRecord]:
    """Like list_health_records, but scoped to records that person has
    marked visible_to_family — for viewing someone else's report, never
    your own (see app.api.health_records for the split)."""
    result = await db.execute(
        select(HealthRecord).where(
            HealthRecord.person_id == person_id, HealthRecord.visible_to_family.is_(True)
        )
    )
    return list(result.scalars().all())


# --- Family health matching --------------------------------------------
# Powers the "compare" button: ranks the ego's family members by how
# closely their latest health data matches the ego's own. Kept as plain,
# unit-testable Python (no medical reference ranges, no extra deps beyond
# stdlib difflib) — same philosophy as relationship_service's graph walk.


def age_from_dob(dob: date | None) -> int | None:
    if dob is None:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def latest_by_category(records: list[HealthRecord]) -> dict[str, HealthRecord]:
    latest: dict[str, HealthRecord] = {}
    for record in records:
        current = latest.get(record.category)
        if current is None or record.recorded_at > current.recorded_at:
            latest[record.category] = record
    return latest


def _to_mgdl(value: float, unit: str | None) -> float:
    # 1 mmol/L glucose or cholesterol ~= 18.0182 mg/dL.
    return value * 18.0182 if unit == "mmol/L" else value


def _relative_similarity(a: float, b: float) -> float:
    denom = (abs(a) + abs(b)) / 2
    if denom == 0:
        return 1.0
    return max(0.0, 1 - abs(a - b) / denom)


def _text_similarity(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a.strip().lower(), b.strip().lower()).ratio()


def _category_similarity(category: str, mine: dict, theirs: dict) -> float | None:
    if category == "blood_sugar":
        try:
            a = _to_mgdl(float(mine["value"]), mine.get("unit"))
            b = _to_mgdl(float(theirs["value"]), theirs.get("unit"))
        except (KeyError, TypeError, ValueError):
            return None
        return _relative_similarity(a, b)

    if category == "blood_pressure":
        try:
            systolic_sim = _relative_similarity(float(mine["systolic"]), float(theirs["systolic"]))
            diastolic_sim = _relative_similarity(float(mine["diastolic"]), float(theirs["diastolic"]))
        except (KeyError, TypeError, ValueError):
            return None
        return (systolic_sim + diastolic_sim) / 2

    if category == "cholesterol":
        sims: list[float] = []
        for field in ("total", "hdl", "ldl", "triglycerides"):
            mine_val, theirs_val = mine.get(field), theirs.get(field)
            if mine_val is None or theirs_val is None:
                continue
            try:
                a = _to_mgdl(float(mine_val), mine.get("unit"))
                b = _to_mgdl(float(theirs_val), theirs.get("unit"))
            except (TypeError, ValueError):
                continue
            sims.append(_relative_similarity(a, b))
        return sum(sims) / len(sims) if sims else None

    if category in ("condition", "other"):
        mine_name, theirs_name = mine.get("name"), theirs.get("name")
        if not mine_name or not theirs_name:
            return None
        return _text_similarity(str(mine_name), str(theirs_name))

    return None


async def get_family_health_snapshots(
    db: AsyncSession, viewer: Person
) -> list[tuple[Person, dict[str, HealthRecord]]]:
    """Every other person in viewer's family, paired with their latest
    health record per category — restricted to records they've marked
    visible_to_family. Shared groundwork for both "compare" (scores these
    against viewer's own) and the health-criteria search below (filters
    these directly, no comparison to viewer needed)."""
    persons = await load_family_persons(db, viewer.family_id)
    candidate_ids = [person_id for person_id in persons if person_id != viewer.id]
    if not candidate_ids:
        return []

    result = await db.execute(
        select(HealthRecord).where(
            HealthRecord.person_id.in_(candidate_ids),
            HealthRecord.visible_to_family.is_(True),
        )
    )
    records_by_person: dict[uuid.UUID, list[HealthRecord]] = {}
    for record in result.scalars().all():
        records_by_person.setdefault(record.person_id, []).append(record)

    return [
        (persons[person_id], latest_by_category(records))
        for person_id, records in records_by_person.items()
        if person_id in persons
    ]


async def find_family_health_matches(
    db: AsyncSession, ego: Person, limit: int = 10
) -> list[tuple[Person, float]]:
    """Ranks every other person in ego's family by how closely their latest
    health record per category matches ego's own."""
    ego_latest = latest_by_category(await list_health_records(db, ego.id))
    if not ego_latest:
        return []

    snapshots = await get_family_health_snapshots(db, ego)

    scored: list[tuple[Person, float]] = []
    for person, theirs_latest in snapshots:
        sims: list[float] = []
        for category, mine_record in ego_latest.items():
            theirs_record = theirs_latest.get(category)
            if theirs_record is None:
                continue
            sim = _category_similarity(category, mine_record.value, theirs_record.value)
            if sim is not None:
                sims.append(sim)

        if not sims:
            continue
        scored.append((person, sum(sims) / len(sims) * 100))

    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored[:limit]


# --- Natural-language health search --------------------------------------
# Powers the search box's "siblings with sugar level higher than 300" /
# "who has blood pressure above mine" style queries. A lightweight,
# regex-based parser rather than an LLM call — this runs on every keystroke
# from the frontend, so it has to be instant and free, and the vocabulary
# it needs to cover (a handful of categories, comparators, "me") is small
# and closed enough that regex handles it cleanly.

_CATEGORY_PATTERNS: list[tuple[re.Pattern[str], str, str | None]] = [
    (re.compile(r"\bsystolic\b"), "blood_pressure", "systolic"),
    (re.compile(r"\bdiastolic\b"), "blood_pressure", "diastolic"),
    (re.compile(r"\bblood\s*pressure\b|\bbp\b"), "blood_pressure", "systolic"),
    (re.compile(r"\btriglycerides?\b"), "cholesterol", "triglycerides"),
    (re.compile(r"\bhdl\b"), "cholesterol", "hdl"),
    (re.compile(r"\bldl\b"), "cholesterol", "ldl"),
    (re.compile(r"\bcholesterol\b"), "cholesterol", "total"),
    (re.compile(r"\bblood\s*sugar\b|\bsugar\s*level\b|\bsugar\b|\bglucose\b"), "blood_sugar", None),
]

_COMPARATOR_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bhigher than\b|\bgreater than\b|\bmore than\b|\babove\b|\bover\b"), "gt"),
    (re.compile(r"\blower than\b|\bless than\b|\bbelow\b|\bunder\b"), "lt"),
    (re.compile(r"\bequal to\b|\bsame as\b|\bequals?\b|\bexactly\b"), "eq"),
]

_SELF_REFERENCE = re.compile(r"\bmy own\b|\bmyself\b|\bmine\b|\bme\b|\bmy\b")
_NUMBER = re.compile(r"(\d+(?:\.\d+)?)")

_STOPWORDS = {
    "users", "user", "members", "member", "siblings", "sibling", "family", "with", "who",
    "has", "have", "having", "the", "a", "an", "person", "people", "relatives", "relative",
    "any", "someone", "anyone", "show", "find", "me", "my",
}

# Without one of these, plain text (e.g. someone's name typed into the same
# search box) would otherwise fall through and get misread as a condition
# search term.
_CONDITION_SIGNAL = re.compile(
    r"\bwith\b|\bhas\b|\bhave\b|\bhaving\b|\bcondition\b|\bdisorder\b|\bdiagnos\w*\b|\bsuffering\b"
)


@dataclass(frozen=True)
class ParsedHealthQuery:
    kind: Literal["numeric", "condition"]
    category: str | None = None
    field: str | None = None
    operator: str | None = None
    threshold: float | None = None
    use_own_value: bool = False
    term: str | None = None
    # Substrings to match against each candidate's relationship label from
    # relationship_service.describe_blood_relation (e.g. "sister",
    # "grandfather", "2nd cousin, once removed") — so "siblings with sugar
    # ..." actually narrows to siblings instead of the word being discarded.
    relationship_keywords: tuple[str, ...] | None = None


# Matched against the *label* relationship_service produces for each
# relative, not recomputed independently — "aunt" also catches "great-aunt",
# "cousin" catches every cousin degree/removal, etc., for free.
_RELATIONSHIP_KEYWORDS: list[tuple[re.Pattern[str], tuple[str, ...]]] = [
    (re.compile(r"\bsisters?\b"), ("sister",)),
    (re.compile(r"\bbrothers?\b"), ("brother",)),
    (re.compile(r"\bsiblings?\b"), ("brother", "sister", "sibling")),
    (re.compile(r"\bmothers?\b"), ("mother",)),
    (re.compile(r"\bfathers?\b"), ("father",)),
    (re.compile(r"\bparents?\b"), ("mother", "father", "parent")),
    (re.compile(r"\bdaughters?\b"), ("daughter",)),
    (re.compile(r"\bsons?\b"), ("son",)),
    (re.compile(r"\bchildren\b|\bkids?\b"), ("son", "daughter", "child")),
    (re.compile(r"\bgrandmothers?\b"), ("grandmother",)),
    (re.compile(r"\bgrandfathers?\b"), ("grandfather",)),
    (re.compile(r"\bgrandparents?\b"), ("grandmother", "grandfather", "grandparent")),
    (re.compile(r"\bgranddaughters?\b"), ("granddaughter",)),
    (re.compile(r"\bgrandsons?\b"), ("grandson",)),
    (re.compile(r"\bgrandchildren\b"), ("grandson", "granddaughter", "grandchild")),
    (re.compile(r"\baunts?\b"), ("aunt",)),
    (re.compile(r"\buncles?\b"), ("uncle",)),
    (re.compile(r"\bnieces?\b"), ("niece",)),
    (re.compile(r"\bnephews?\b"), ("nephew",)),
    (re.compile(r"\bcousins?\b"), ("cousin",)),
    (re.compile(r"\bwives?\b"), ("wife",)),
    (re.compile(r"\bhusbands?\b"), ("husband",)),
    (re.compile(r"\bspouses?\b"), ("wife", "husband", "spouse")),
    (re.compile(r"\bin-?laws?\b"), ("-in-law",)),
]


def _match_relationship_keywords(query: str) -> tuple[str, ...] | None:
    for pattern, labels in _RELATIONSHIP_KEYWORDS:
        if pattern.search(query):
            return labels
    return None


def person_ids_matching_relationship(
    graph: FamilyGraph, persons: dict[uuid.UUID, Person], viewer_id: uuid.UUID, keywords: tuple[str, ...]
) -> set[uuid.UUID]:
    """Every person whose relationship label to viewer (as
    relationship_service would describe it — "sister", "great-aunt", "2nd
    cousin, once removed", ...) contains one of the given keyword
    substrings. Reuses the same relationship engine the tree/profile pages
    already rely on, so "siblings" here means exactly what it means there."""
    relatives = build_relative_list(graph, persons, viewer_id)
    return {
        relative.person.id
        for relative in relatives
        if any(keyword in relative.relationship for keyword in keywords)
    }


def _extract_condition_term(query: str) -> str:
    words = re.findall(r"[a-zA-Z]+", query.lower())
    meaningful = [w for w in words if w not in _STOPWORDS]
    return " ".join(meaningful).strip()


def parse_health_query(query: str) -> ParsedHealthQuery | None:
    """Best-effort parse of a search-box query into a health-criteria
    filter. Returns None when the text doesn't look like a health query at
    all (e.g. it's just someone's name), so the caller can fall back to
    plain name search instead of showing "no results"."""
    q = query.lower().strip()
    if not q:
        return None

    relationship_keywords = _match_relationship_keywords(q)

    category = field = None
    for pattern, cat, fld in _CATEGORY_PATTERNS:
        if pattern.search(q):
            category, field = cat, fld
            break

    if category is not None:
        operator = None
        for pattern, op in _COMPARATOR_PATTERNS:
            if pattern.search(q):
                operator = op
                break
        if operator is None:
            return None

        if _SELF_REFERENCE.search(q):
            return ParsedHealthQuery(
                kind="numeric",
                category=category,
                field=field,
                operator=operator,
                use_own_value=True,
                relationship_keywords=relationship_keywords,
            )

        number_match = _NUMBER.search(q)
        if not number_match:
            return None
        return ParsedHealthQuery(
            kind="numeric",
            category=category,
            field=field,
            operator=operator,
            threshold=float(number_match.group(1)),
            relationship_keywords=relationship_keywords,
        )

    if not _CONDITION_SIGNAL.search(q):
        return None
    term = _extract_condition_term(q)
    if not term:
        return None
    return ParsedHealthQuery(kind="condition", term=term, relationship_keywords=relationship_keywords)


def _numeric_field_value(record: HealthRecord, category: str, field: str | None) -> float | None:
    value = record.value
    try:
        if category == "blood_sugar":
            return _to_mgdl(float(value["value"]), value.get("unit"))
        if category == "blood_pressure":
            return float(value[field or "systolic"])
        if category == "cholesterol":
            raw = value.get(field or "total")
            return _to_mgdl(float(raw), value.get("unit")) if raw is not None else None
    except (KeyError, TypeError, ValueError):
        return None
    return None


def _compare(operator: str, actual: float, threshold: float) -> bool:
    if operator == "gt":
        return actual > threshold
    if operator == "lt":
        return actual < threshold
    # "equal" allows a little slack rather than requiring exact float
    # equality, since health readings are rarely typed to match precisely.
    return abs(actual - threshold) <= max(1.0, threshold * 0.02)


def _describe_numeric_value(category: str, field: str | None, value: dict) -> str:
    if category == "blood_sugar":
        return f"{value.get('value')} {value.get('unit') or 'mg/dL'}"
    if category == "blood_pressure":
        return f"{value.get('systolic')}/{value.get('diastolic')} mmHg"
    if category == "cholesterol":
        label = {"hdl": "HDL", "ldl": "LDL", "triglycerides": "Triglycerides"}.get(field or "total", "Total")
        return f"{label} {value.get(field or 'total')} {value.get('unit') or 'mg/dL'}"
    return ""


def search_family_by_health(
    snapshots: list[tuple[Person, dict[str, HealthRecord]]],
    parsed: ParsedHealthQuery,
    viewer_latest: dict[str, HealthRecord],
) -> list[tuple[Person, str]]:
    """Applies a parsed query to a family's health snapshots (as returned by
    get_family_health_snapshots), returning (person, human-readable matched
    value) pairs for everyone who matches."""
    if parsed.kind == "numeric":
        threshold = parsed.threshold
        if parsed.use_own_value:
            own_record = viewer_latest.get(parsed.category)
            threshold = (
                _numeric_field_value(own_record, parsed.category, parsed.field)
                if own_record is not None
                else None
            )
        if threshold is None:
            return []

        matches: list[tuple[Person, str]] = []
        for person, latest in snapshots:
            record = latest.get(parsed.category)
            if record is None:
                continue
            actual = _numeric_field_value(record, parsed.category, parsed.field)
            if actual is None:
                continue
            if _compare(parsed.operator, actual, threshold):
                matches.append((person, _describe_numeric_value(parsed.category, parsed.field, record.value)))
        return matches

    term = (parsed.term or "").lower()
    matches = []
    for person, latest in snapshots:
        for category in ("other", "condition"):
            record = latest.get(category)
            if record is None:
                continue
            name = str(record.value.get("name", "")).lower()
            notes = str(record.value.get("notes", "")).lower()
            if term in name or term in notes:
                matches.append((person, str(record.value.get("name")) or "Condition on record"))
                break
    return matches
