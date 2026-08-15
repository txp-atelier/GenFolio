import uuid

from app.models.person import Person
from app.services.relationship_service import (
    blood_relation,
    build_family_graph,
    build_relative_list,
    describe_blood_relation,
)


def _person(first_name: str, sex: str | None = None) -> Person:
    return Person(
        id=uuid.uuid4(),
        family_id=uuid.uuid4(),
        first_name=first_name,
        last_name="Test",
        sex=sex,
        is_claimed=True,
    )


def _make_family():
    """
    grandpa === grandma
        |
   +----+----+
   |         |
  dad ===mom aunt === uncle
   |             |
  +--+--+       cousin
  |     |
 ego  sibling
  |
spouse === ego
  |
 kid
    """
    grandpa = _person("Grandpa", "male")
    grandma = _person("Grandma", "female")
    dad = _person("Dad", "male")
    mom = _person("Mom", "female")
    aunt = _person("Aunt", "female")
    uncle = _person("Uncle", "male")
    cousin = _person("Cousin", "female")
    ego = _person("Ego", "female")
    sibling = _person("Sibling", "male")
    spouse = _person("Spouse", "male")
    kid = _person("Kid", "male")

    edges = [
        ("SPOUSE_OF", grandpa.id, grandma.id),
        ("PARENT_OF", grandpa.id, dad.id),
        ("PARENT_OF", grandma.id, dad.id),
        ("PARENT_OF", grandpa.id, aunt.id),
        ("PARENT_OF", grandma.id, aunt.id),
        ("SPOUSE_OF", dad.id, mom.id),
        ("PARENT_OF", dad.id, ego.id),
        ("PARENT_OF", mom.id, ego.id),
        ("PARENT_OF", dad.id, sibling.id),
        ("PARENT_OF", mom.id, sibling.id),
        ("SPOUSE_OF", aunt.id, uncle.id),
        ("PARENT_OF", aunt.id, cousin.id),
        ("PARENT_OF", uncle.id, cousin.id),
        ("SPOUSE_OF", ego.id, spouse.id),
        ("PARENT_OF", ego.id, kid.id),
        ("PARENT_OF", spouse.id, kid.id),
    ]
    graph = build_family_graph(edges)
    persons = {
        p.id: p
        for p in [grandpa, grandma, dad, mom, aunt, uncle, cousin, ego, sibling, spouse, kid]
    }
    return graph, persons, dict(
        grandpa=grandpa,
        grandma=grandma,
        dad=dad,
        mom=mom,
        aunt=aunt,
        uncle=uncle,
        cousin=cousin,
        ego=ego,
        sibling=sibling,
        spouse=spouse,
        kid=kid,
    )


def test_direct_lineage():
    graph, _, p = _make_family()
    assert blood_relation(graph, p["ego"].id, p["dad"].id) == (1, 0)
    assert blood_relation(graph, p["ego"].id, p["grandpa"].id) == (2, 0)
    assert blood_relation(graph, p["ego"].id, p["kid"].id) == (0, 1)


def test_sibling_via_shared_parents():
    graph, _, p = _make_family()
    assert blood_relation(graph, p["ego"].id, p["sibling"].id) == (1, 1)


def test_aunt_uncle_and_cousin():
    graph, _, p = _make_family()
    # Aunt is blood (grandparent's child); uncle is not blood (married in).
    assert blood_relation(graph, p["ego"].id, p["aunt"].id) == (2, 1)
    assert blood_relation(graph, p["ego"].id, p["uncle"].id) is None
    assert blood_relation(graph, p["ego"].id, p["cousin"].id) == (2, 2)


def test_unrelated_people_have_no_blood_relation():
    graph, _, p = _make_family()
    assert blood_relation(graph, p["spouse"].id, p["grandpa"].id) is None


def test_describe_blood_relation_labels_are_gendered():
    assert describe_blood_relation(1, 0, "male") == "father"
    assert describe_blood_relation(1, 0, "female") == "mother"
    assert describe_blood_relation(1, 0, None) == "parent"
    assert describe_blood_relation(2, 0, "male") == "grandfather"
    assert describe_blood_relation(3, 0, "female") == "great-grandmother"
    assert describe_blood_relation(0, 1, "male") == "son"
    assert describe_blood_relation(1, 1, "male") == "brother"
    assert describe_blood_relation(2, 1, "female") == "aunt"
    assert describe_blood_relation(1, 2, "male") == "nephew"
    assert describe_blood_relation(2, 2, None) == "cousin"
    assert describe_blood_relation(3, 2, None) == "cousin, once removed"
    assert describe_blood_relation(3, 3, None) == "2nd cousin"


def test_build_relative_list_covers_blood_spouse_and_in_law():
    graph, persons, p = _make_family()
    relatives = {r.person.id: r for r in build_relative_list(graph, persons, p["ego"].id)}

    assert relatives[p["dad"].id].relationship == "father"
    assert relatives[p["dad"].id].category == "blood"

    assert relatives[p["sibling"].id].relationship == "brother"
    assert relatives[p["sibling"].id].category == "blood"

    assert relatives[p["aunt"].id].relationship == "aunt"
    assert relatives[p["aunt"].id].category == "blood"

    assert relatives[p["cousin"].id].relationship == "cousin"

    # Uncle isn't blood — he's aunt's husband, surfaced as an in-law and
    # gendered by his own sex (not aunt's).
    assert relatives[p["uncle"].id].category == "in_law"
    assert relatives[p["uncle"].id].relationship == "uncle (by marriage)"

    # Ego's own spouse.
    assert relatives[p["spouse"].id].category == "spouse"
    assert relatives[p["spouse"].id].relationship == "husband"

    # Ego not included in her own relative list.
    assert p["ego"].id not in relatives


def test_in_law_gendered_by_in_law_persons_own_sex_not_the_blood_relatives():
    # Regression test: a sister's husband must be labeled "brother-in-law"
    # (his own sex), not "sister-in-law" (reusing the sister's label).
    grandpa = _person("Grandpa", "male")
    grandma = _person("Grandma", "female")
    ego = _person("Ego", "male")
    sister = _person("Sister", "female")
    sisters_husband = _person("Sister's Husband", "male")

    edges = [
        ("PARENT_OF", grandpa.id, ego.id),
        ("PARENT_OF", grandma.id, ego.id),
        ("PARENT_OF", grandpa.id, sister.id),
        ("PARENT_OF", grandma.id, sister.id),
        ("SPOUSE_OF", sister.id, sisters_husband.id),
    ]
    graph = build_family_graph(edges)
    persons = {p.id: p for p in [grandpa, grandma, ego, sister, sisters_husband]}

    relatives = {r.person.id: r for r in build_relative_list(graph, persons, ego.id)}
    assert relatives[sisters_husband.id].relationship == "brother-in-law"
    assert relatives[sisters_husband.id].category == "in_law"
