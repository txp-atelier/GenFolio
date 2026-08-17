import uuid
from datetime import date, datetime, timedelta, timezone

from app.models.health_record import HealthRecord
from app.models.person import Person
from app.services.health_record_service import (
    _category_similarity,
    age_from_dob,
    latest_by_category,
    parse_health_query,
    person_ids_matching_relationship,
    search_family_by_health,
    _relative_similarity,
    _text_similarity,
)
from app.services.relationship_service import build_family_graph

BASE = datetime(2024, 6, 1, tzinfo=timezone.utc)


def _record(category: str, value: dict, days_ago: int = 0) -> HealthRecord:
    return HealthRecord(
        id=uuid.uuid4(),
        person_id=uuid.uuid4(),
        category=category,
        value=value,
        recorded_at=BASE - timedelta(days=days_ago),
        visible_to_family=True,
    )


def test_age_from_dob_before_birthday_this_year():
    today = date.today()
    dob = date(today.year - 30, today.month, today.day) + timedelta(days=1)
    assert age_from_dob(dob) == 29


def test_age_from_dob_after_birthday_this_year():
    today = date.today()
    dob = date(today.year - 30, today.month, today.day) - timedelta(days=1)
    assert age_from_dob(dob) == 30


def test_age_from_dob_none():
    assert age_from_dob(None) is None


def test_latest_by_category_picks_newest_per_category():
    older = _record("blood_sugar", {"value": 90, "unit": "mg/dL"}, days_ago=10)
    newer = _record("blood_sugar", {"value": 95, "unit": "mg/dL"}, days_ago=1)
    other = _record("blood_pressure", {"systolic": 120, "diastolic": 80}, days_ago=5)

    latest = latest_by_category([older, newer, other])

    assert latest["blood_sugar"] is newer
    assert latest["blood_pressure"] is other


def test_relative_similarity_identical_values():
    assert _relative_similarity(100, 100) == 1.0


def test_relative_similarity_decreases_with_distance():
    close = _relative_similarity(100, 105)
    far = _relative_similarity(100, 200)
    assert 0 < far < close < 1.0


def test_relative_similarity_clamped_to_zero():
    assert _relative_similarity(1, 1000) >= 0.0


def test_text_similarity_identical_case_insensitive():
    assert _text_similarity("Type 2 Diabetes", "type 2 diabetes") == 1.0


def test_text_similarity_unrelated_strings_score_low():
    assert _text_similarity("Diabetes", "Asthma") < 0.5


def test_category_similarity_blood_sugar_converts_units():
    # 5.5 mmol/L glucose ~= 99.1 mg/dL, close to 100 mg/dL.
    sim = _category_similarity(
        "blood_sugar", {"value": 100, "unit": "mg/dL"}, {"value": 5.5, "unit": "mmol/L"}
    )
    assert sim is not None and sim > 0.98


def test_category_similarity_blood_pressure_averages_systolic_diastolic():
    sim = _category_similarity(
        "blood_pressure",
        {"systolic": 120, "diastolic": 80},
        {"systolic": 120, "diastolic": 80},
    )
    assert sim == 1.0


def test_category_similarity_cholesterol_skips_missing_fields():
    sim = _category_similarity(
        "cholesterol",
        {"total": 180, "hdl": 50},
        {"total": 180},
    )
    assert sim == 1.0


def test_category_similarity_cholesterol_no_overlapping_fields_returns_none():
    assert _category_similarity("cholesterol", {"total": 180}, {"hdl": 50}) is None


def test_category_similarity_condition_matches_by_name():
    sim = _category_similarity(
        "condition",
        {"name": "Type 2 Diabetes"},
        {"name": "type 2 diabetes"},
    )
    assert sim == 1.0


def test_category_similarity_missing_value_returns_none():
    assert _category_similarity("blood_sugar", {}, {"value": 100}) is None


def _person(first_name: str) -> Person:
    return Person(
        id=uuid.uuid4(), family_id=uuid.uuid4(), first_name=first_name, last_name="Test", is_claimed=True
    )


def test_parse_health_query_numeric_threshold():
    parsed = parse_health_query("siblings with sugar level higher than 300")
    assert parsed is not None
    assert parsed.kind == "numeric"
    assert parsed.category == "blood_sugar"
    assert parsed.operator == "gt"
    assert parsed.threshold == 300
    assert parsed.use_own_value is False


def test_parse_health_query_compared_to_me():
    parsed = parse_health_query("members with sugar level higher than me")
    assert parsed is not None
    assert parsed.kind == "numeric"
    assert parsed.category == "blood_sugar"
    assert parsed.operator == "gt"
    assert parsed.use_own_value is True
    assert parsed.threshold is None


def test_parse_health_query_blood_pressure_lower_than():
    parsed = parse_health_query("who has blood pressure lower than 110")
    assert parsed is not None
    assert parsed.category == "blood_pressure"
    assert parsed.field == "systolic"
    assert parsed.operator == "lt"
    assert parsed.threshold == 110


def test_parse_health_query_cholesterol_subfield():
    parsed = parse_health_query("family with LDL above 160")
    assert parsed is not None
    assert parsed.category == "cholesterol"
    assert parsed.field == "ldl"
    assert parsed.operator == "gt"
    assert parsed.threshold == 160


def test_parse_health_query_condition_fallback():
    parsed = parse_health_query("members with diabetes")
    assert parsed is not None
    assert parsed.kind == "condition"
    assert parsed.term == "diabetes"


def test_parse_health_query_plain_name_is_unrecognized():
    assert parse_health_query("John Smith") is None


def test_parse_health_query_category_without_comparator_is_unrecognized():
    # A bare category keyword without a comparator isn't a confident
    # numeric filter, so it's treated as unrecognized rather than guessed at.
    assert parse_health_query("cholesterol") is None


def test_search_family_by_health_numeric_filters_correctly():
    alice, bob = _person("Alice"), _person("Bob")
    snapshots = [
        (alice, {"blood_sugar": _record("blood_sugar", {"value": 320, "unit": "mg/dL"})}),
        (bob, {"blood_sugar": _record("blood_sugar", {"value": 90, "unit": "mg/dL"})}),
    ]
    parsed = parse_health_query("members with sugar level higher than 300")

    matches = search_family_by_health(snapshots, parsed, viewer_latest={})

    assert [p.first_name for p, _ in matches] == ["Alice"]


def test_search_family_by_health_compares_to_viewer_value():
    alice, bob = _person("Alice"), _person("Bob")
    snapshots = [
        (alice, {"blood_sugar": _record("blood_sugar", {"value": 200, "unit": "mg/dL"})}),
        (bob, {"blood_sugar": _record("blood_sugar", {"value": 90, "unit": "mg/dL"})}),
    ]
    parsed = parse_health_query("siblings with sugar level higher than me")
    viewer_latest = {"blood_sugar": _record("blood_sugar", {"value": 150, "unit": "mg/dL"})}

    matches = search_family_by_health(snapshots, parsed, viewer_latest)

    assert [p.first_name for p, _ in matches] == ["Alice"]


def test_search_family_by_health_condition_term_matches_name_or_notes():
    alice, bob = _person("Alice"), _person("Bob")
    snapshots = [
        (alice, {"other": _record("other", {"name": "Type 2 Diabetes", "notes": ""})}),
        (bob, {"other": _record("other", {"name": "Eczema", "notes": ""})}),
    ]
    parsed = parse_health_query("members with diabetes")

    matches = search_family_by_health(snapshots, parsed, viewer_latest={})

    assert [p.first_name for p, _ in matches] == ["Alice"]


def test_parse_health_query_relationship_keyword_narrows_results():
    parsed = parse_health_query("siblings with sugar level higher than 300")
    assert parsed is not None
    assert parsed.relationship_keywords == ("brother", "sister", "sibling")


def test_parse_health_query_without_relationship_word_has_none():
    parsed = parse_health_query("members with sugar level higher than 300")
    assert parsed is not None
    assert parsed.relationship_keywords is None


def _make_relationship_fixture():
    """
       grandpa === grandma
           |
      +----+----+
      |         |
     dad       aunt
      |          |
   +--+--+     cousin
   |     |
  ego  sibling
    """
    grandpa = _person("Grandpa")
    grandma = _person("Grandma")
    dad = _person("Dad")
    aunt = _person("Aunt")
    ego = _person("Ego")
    sibling = _person("Sibling")
    cousin = _person("Cousin")

    edges = [
        ("PARENT_OF", grandpa.id, dad.id),
        ("PARENT_OF", grandma.id, dad.id),
        ("PARENT_OF", grandpa.id, aunt.id),
        ("PARENT_OF", grandma.id, aunt.id),
        ("PARENT_OF", dad.id, ego.id),
        ("PARENT_OF", dad.id, sibling.id),
        ("PARENT_OF", aunt.id, cousin.id),
    ]
    graph = build_family_graph(edges)
    persons = {p.id: p for p in [grandpa, grandma, dad, aunt, ego, sibling, cousin]}
    return (
        graph,
        persons,
        dict(grandpa=grandpa, grandma=grandma, dad=dad, aunt=aunt, ego=ego, sibling=sibling, cousin=cousin),
    )


def test_person_ids_matching_relationship_filters_to_siblings_only():
    graph, persons, p = _make_relationship_fixture()
    matches = person_ids_matching_relationship(graph, persons, p["ego"].id, ("brother", "sister", "sibling"))
    assert matches == {p["sibling"].id}


def test_person_ids_matching_relationship_aunt():
    graph, persons, p = _make_relationship_fixture()
    matches = person_ids_matching_relationship(graph, persons, p["ego"].id, ("aunt",))
    assert matches == {p["aunt"].id}


def test_person_ids_matching_relationship_cousin():
    graph, persons, p = _make_relationship_fixture()
    matches = person_ids_matching_relationship(graph, persons, p["ego"].id, ("cousin",))
    assert matches == {p["cousin"].id}
