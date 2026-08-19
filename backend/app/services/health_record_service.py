import difflib
import re
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.health_record import HealthRecord
from app.models.person import Person
from app.schemas.health_record_values import VALUE_SCHEMAS_BY_CATEGORY
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

    if value is not None:
        record.value = validate_value(record.category, value)
    if recorded_at is not None:
        record.recorded_at = recorded_at
    if visible_to_family is not None:
        record.visible_to_family = visible_to_family

    await db.commit()
    await db.refresh(record)
    return record


async def delete_health_record(db: AsyncSession, person_id: uuid.UUID, record_id: uuid.UUID) -> uuid.UUID:
    record = await get_own_health_record(db, person_id, record_id)
    record_id_copy = record.id
    await db.delete(record)
    await db.commit()
    return record_id_copy


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

# "high sugar" / "elevated blood pressure" / "low cholesterol" / "normal
# blood sugar" — a category with no explicit number still says enough to
# filter on, via a reasonable general-population reference point (not a
# diagnostic threshold — framed purely as a descriptive filter, same spirit
# as the chatbot's own "not a diagnosis" framing).
_HIGH_QUALIFIER = re.compile(r"\bhigh\b|\bhigher\b|\belevated\b|\braised\b")
_LOW_QUALIFIER = re.compile(r"\blow\b|\blower\b|\breduced\b")
_NORMAL_QUALIFIER = re.compile(r"\bnormal\b|\bhealthy\b|\bregular\b")

# gt/lt bound a single reading; "normal" is derived from the same two
# numbers as the range between them, not a separate reference point.
_DEFAULT_QUALIFIER_THRESHOLD: dict[tuple[str, str | None], dict[str, float]] = {
    ("blood_sugar", None): {"gt": 125.0, "lt": 70.0},
    ("blood_pressure", "systolic"): {"gt": 130.0, "lt": 90.0},
    ("blood_pressure", "diastolic"): {"gt": 80.0, "lt": 60.0},
    ("cholesterol", "total"): {"gt": 200.0, "lt": 120.0},
    ("cholesterol", "ldl"): {"gt": 130.0, "lt": 40.0},
    ("cholesterol", "hdl"): {"gt": 60.0, "lt": 40.0},
    ("cholesterol", "triglycerides"): {"gt": 150.0, "lt": 50.0},
}

# Whether the query named a specific BP number explicitly ("systolic"/
# "diastolic") — without one, "high"/"low"/"normal" blood pressure checks
# both readings rather than just the default (systolic), since e.g. 125/95
# would misleadingly count as "normal" on systolic alone.
_EXPLICIT_BP_FIELD = re.compile(r"\bsystolic\b|\bdiastolic\b")


def _match_qualifier(query: str) -> str | None:
    if _NORMAL_QUALIFIER.search(query):
        return "normal"
    if _HIGH_QUALIFIER.search(query):
        return "gt"
    if _LOW_QUALIFIER.search(query):
        return "lt"
    return None


def _bp_pair(record: HealthRecord) -> tuple[float, float] | None:
    try:
        return float(record.value["systolic"]), float(record.value["diastolic"])
    except (KeyError, TypeError, ValueError):
        return None


def _matches_bp_qualifier(operator: str, systolic: float, diastolic: float) -> bool:
    sys_range = _DEFAULT_QUALIFIER_THRESHOLD[("blood_pressure", "systolic")]
    dia_range = _DEFAULT_QUALIFIER_THRESHOLD[("blood_pressure", "diastolic")]
    if operator == "gt":
        return systolic > sys_range["gt"] or diastolic > dia_range["gt"]
    if operator == "lt":
        return systolic < sys_range["lt"] or diastolic < dia_range["lt"]
    if operator == "normal":
        return sys_range["lt"] <= systolic <= sys_range["gt"] and dia_range["lt"] <= diastolic <= dia_range["gt"]
    return False


@dataclass(frozen=True)
class ParsedHealthQuery:
    """A search-box query recognized as an explicit vitals filter (a
    category, plus either a number/qualifier or "than mine"). Anything else
    — including free-text condition descriptions like "who is bald" — isn't
    handled here at all; parse_health_query returns None for those, and the
    caller (search_by_health_query) sends the raw query to semantic
    retrieval instead (see rag_service.find_family_members_by_query)."""

    category: str
    field: str | None = None
    operator: str = "gt"  # "gt" | "lt" | "eq" | "normal"
    threshold: float | None = None
    # Only set when operator == "normal": the upper bound of the range
    # (threshold is the lower bound in that case).
    range_high: float | None = None
    use_own_value: bool = False
    # True for an unqualified "high/low/normal blood pressure" (no
    # "systolic"/"diastolic" named) — checked against both readings at once
    # rather than just the default (systolic) field.
    both_bp_fields: bool = False
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


def _default_field_for(category: str) -> str | None:
    if category == "blood_pressure":
        return "systolic"
    if category == "cholesterol":
        return "total"
    return None


def parse_health_query(query: str) -> ParsedHealthQuery | None:
    """Recognizes an explicit vitals filter — a category name plus either a
    number, a "than mine" self-reference, or a high/low qualifier with an
    implied default threshold. Returns None for everything else (plain
    names, and free-text condition descriptions like "who is bald" or
    "diabetics" alike) — the caller treats None as a signal to try semantic
    retrieval instead, not to give up."""
    q = query.lower().strip()
    if not q:
        return None

    relationship_keywords = _match_relationship_keywords(q)

    category = field = None
    for pattern, cat, fld in _CATEGORY_PATTERNS:
        if pattern.search(q):
            category, field = cat, fld
            break
    if category is None:
        return None

    operator = None
    for pattern, op in _COMPARATOR_PATTERNS:
        if pattern.search(q):
            operator = op
            break

    if operator is not None:
        if _SELF_REFERENCE.search(q):
            return ParsedHealthQuery(
                category=category,
                field=field,
                operator=operator,
                use_own_value=True,
                relationship_keywords=relationship_keywords,
            )
        number_match = _NUMBER.search(q)
        if number_match:
            return ParsedHealthQuery(
                category=category,
                field=field,
                operator=operator,
                threshold=float(number_match.group(1)),
                relationship_keywords=relationship_keywords,
            )
        # An explicit comparator with no number or "mine" to compare
        # against ("sugar level higher than...?") isn't a usable filter —
        # fall through to the qualifier check below rather than guessing.

    qualifier = _match_qualifier(q)
    if qualifier is not None:
        if category == "blood_pressure" and not _EXPLICIT_BP_FIELD.search(q):
            return ParsedHealthQuery(
                category=category,
                operator=qualifier,
                both_bp_fields=True,
                relationship_keywords=relationship_keywords,
            )

        thresholds = _DEFAULT_QUALIFIER_THRESHOLD.get((category, field or _default_field_for(category)))
        if thresholds:
            if qualifier == "normal":
                return ParsedHealthQuery(
                    category=category,
                    field=field,
                    operator="normal",
                    threshold=thresholds["lt"],
                    range_high=thresholds["gt"],
                    relationship_keywords=relationship_keywords,
                )
            if qualifier in thresholds:
                return ParsedHealthQuery(
                    category=category,
                    field=field,
                    operator=qualifier,
                    threshold=thresholds[qualifier],
                    relationship_keywords=relationship_keywords,
                )

    return None


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


def describe_numeric_value(category: str, field: str | None, value: dict) -> str:
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
    """Applies a parsed vitals filter to a family's health snapshots (as
    returned by get_family_health_snapshots), returning (person,
    human-readable matched value) pairs for everyone who matches. Free-text
    condition queries ("who is bald") never reach here — parse_health_query
    returns None for those, and the caller uses semantic retrieval instead
    (see rag_service.find_family_members_by_query)."""
    if parsed.both_bp_fields:
        matches: list[tuple[Person, str]] = []
        for person, latest in snapshots:
            record = latest.get("blood_pressure")
            if record is None:
                continue
            pair = _bp_pair(record)
            if pair is None:
                continue
            systolic, diastolic = pair
            if _matches_bp_qualifier(parsed.operator, systolic, diastolic):
                matches.append((person, describe_numeric_value("blood_pressure", None, record.value)))
        return matches

    if parsed.operator == "normal":
        low, high = parsed.threshold, parsed.range_high
        if low is None or high is None:
            return []
        matches = []
        for person, latest in snapshots:
            record = latest.get(parsed.category)
            if record is None:
                continue
            actual = _numeric_field_value(record, parsed.category, parsed.field)
            if actual is None:
                continue
            if low <= actual <= high:
                matches.append((person, describe_numeric_value(parsed.category, parsed.field, record.value)))
        return matches

    threshold = parsed.threshold
    if parsed.use_own_value:
        own_record = viewer_latest.get(parsed.category)
        threshold = (
            _numeric_field_value(own_record, parsed.category, parsed.field) if own_record is not None else None
        )
    if threshold is None:
        return []

    matches = []
    for person, latest in snapshots:
        record = latest.get(parsed.category)
        if record is None:
            continue
        actual = _numeric_field_value(record, parsed.category, parsed.field)
        if actual is None:
            continue
        if _compare(parsed.operator, actual, threshold):
            matches.append((person, describe_numeric_value(parsed.category, parsed.field, record.value)))
    return matches
