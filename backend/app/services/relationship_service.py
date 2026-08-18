"""Derives every family relationship (sibling, grandparent, aunt/uncle,
cousin, in-law, ...) at read time from just two stored edge types
(PARENT_OF, SPOUSE_OF). Nothing beyond those two edge types is ever
persisted — see app.models.relationship for why.

A family is small (dozens to low hundreds of people, not millions), so
rather than hand-rolling recursive SQL for each relationship shape, the
whole family's edges are loaded into memory once and walked with plain
Python. This keeps the traversal logic in pure, easily unit-testable
functions (see tests/test_relationship_service.py) instead of SQL that's
awkward to exercise in isolation.
"""

import uuid
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.person import Person
from app.models.relationship import Relationship

ParentChild = tuple[uuid.UUID, uuid.UUID]


@dataclass(frozen=True)
class FamilyGraph:
    parents_of: dict[uuid.UUID, frozenset[uuid.UUID]] = field(default_factory=dict)
    children_of: dict[uuid.UUID, frozenset[uuid.UUID]] = field(default_factory=dict)
    spouses_of: dict[uuid.UUID, frozenset[uuid.UUID]] = field(default_factory=dict)


def build_family_graph(edges: list[tuple[str, uuid.UUID, uuid.UUID]]) -> FamilyGraph:
    """edges: list of (type, person_a_id, person_b_id). Pure function so it's
    trivial to unit test without a database."""
    parents_of: dict[uuid.UUID, set[uuid.UUID]] = {}
    children_of: dict[uuid.UUID, set[uuid.UUID]] = {}
    spouses_of: dict[uuid.UUID, set[uuid.UUID]] = {}

    for edge_type, a, b in edges:
        if edge_type == "PARENT_OF":
            parent_id, child_id = a, b
            children_of.setdefault(parent_id, set()).add(child_id)
            parents_of.setdefault(child_id, set()).add(parent_id)
        elif edge_type == "SPOUSE_OF":
            spouses_of.setdefault(a, set()).add(b)
            spouses_of.setdefault(b, set()).add(a)
        else:
            raise ValueError(f"Unknown relationship edge type: {edge_type}")

    return FamilyGraph(
        parents_of={k: frozenset(v) for k, v in parents_of.items()},
        children_of={k: frozenset(v) for k, v in children_of.items()},
        spouses_of={k: frozenset(v) for k, v in spouses_of.items()},
    )


async def load_family_graph(db: AsyncSession, family_id: uuid.UUID) -> FamilyGraph:
    result = await db.execute(
        select(Relationship.type, Relationship.person_a_id, Relationship.person_b_id).where(
            Relationship.family_id == family_id
        )
    )
    return build_family_graph([tuple(row) for row in result.all()])


async def load_family_persons(db: AsyncSession, family_id: uuid.UUID) -> dict[uuid.UUID, Person]:
    result = await db.execute(select(Person).where(Person.family_id == family_id))
    return {p.id: p for p in result.scalars().all()}


def ancestors_with_depth(graph: FamilyGraph, person_id: uuid.UUID) -> dict[uuid.UUID, int]:
    """BFS upward via parents_of. Includes person_id itself at depth 0."""
    depths = {person_id: 0}
    frontier = [person_id]
    depth = 0
    while frontier:
        depth += 1
        next_frontier = []
        for p in frontier:
            for parent_id in graph.parents_of.get(p, ()):
                if parent_id not in depths:
                    depths[parent_id] = depth
                    next_frontier.append(parent_id)
        frontier = next_frontier
    return depths


def blood_relation(
    graph: FamilyGraph, ego_id: uuid.UUID, other_id: uuid.UUID
) -> tuple[int, int] | None:
    """Returns (generations_up_to_common_ancestor, generations_down_to_other),
    minimized over every common ancestor — i.e. via the nearest one. None if
    ego and other share no ancestor on record."""
    if ego_id == other_id:
        return (0, 0)

    ego_ancestors = ancestors_with_depth(graph, ego_id)
    other_ancestors = ancestors_with_depth(graph, other_id)
    common = set(ego_ancestors) & set(other_ancestors)
    if not common:
        return None

    return min(((ego_ancestors[c], other_ancestors[c]) for c in common), key=sum)


def _greats(n: int) -> str:
    return "great-" * max(n, 0)


def _ordinal(n: int) -> str:
    if 10 <= n % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def _gendered(sex: str | None, male: str, female: str, neutral: str) -> str:
    if sex == "male":
        return male
    if sex == "female":
        return female
    return neutral


def describe_blood_relation(up: int, down: int, sex: str | None) -> str:
    """up/down as returned by blood_relation(). Labels are relative to ego —
    e.g. describe_blood_relation(1, 0, "female") is ego's mother."""
    if up == 0 and down == 0:
        return "self"

    if down == 0:  # ego's ancestor
        if up == 1:
            return _gendered(sex, "father", "mother", "parent")
        return _greats(up - 2) + _gendered(sex, "grandfather", "grandmother", "grandparent")

    if up == 0:  # ego's descendant
        if down == 1:
            return _gendered(sex, "son", "daughter", "child")
        return _greats(down - 2) + _gendered(sex, "grandson", "granddaughter", "grandchild")

    if up == 1 and down == 1:
        return _gendered(sex, "brother", "sister", "sibling")

    if down == 1 and up >= 2:
        return _greats(up - 2) + _gendered(sex, "uncle", "aunt", "aunt/uncle")

    if up == 1 and down >= 2:
        return _greats(down - 2) + _gendered(sex, "nephew", "niece", "niece/nephew")

    degree = min(up, down) - 1
    removed = abs(up - down)
    # First cousins are just "cousin" in everyday speech — the ordinal only
    # earns its keep from second cousins onward, where it's actually needed
    # to disambiguate.
    label = "cousin" if degree == 1 else f"{_ordinal(degree)} cousin"
    if removed == 1:
        label += ", once removed"
    elif removed > 1:
        label += f", {removed} times removed"
    return label


def describe_in_law_via_relative(up: int, down: int, in_law_sex: str | None) -> str:
    """Label for the spouse of ego's blood relative at (up, down) from ego.
    Gendered by the in-law's own sex — NOT the blood relative's — since e.g.
    a sister's husband is a brother-in-law regardless of the sister's sex."""
    if up == 1 and down == 1:
        return _gendered(in_law_sex, "brother-in-law", "sister-in-law", "sibling-in-law")
    if up == 0 and down == 1:
        return _gendered(in_law_sex, "son-in-law", "daughter-in-law", "child-in-law")
    base = describe_blood_relation(up, down, in_law_sex)
    return f"{base} (by marriage)"


def describe_spouse_relative(up: int, down: int, relative_sex: str | None) -> str:
    """Label for a blood relative of ego's spouse, at (up, down) from the
    spouse, gendered by the relative's own sex."""
    if up == 1 and down == 0:
        return _gendered(relative_sex, "father-in-law", "mother-in-law", "parent-in-law")
    if up == 1 and down == 1:
        return _gendered(relative_sex, "brother-in-law", "sister-in-law", "sibling-in-law")
    base = describe_blood_relation(up, down, relative_sex)
    return f"{base} (by marriage)"


@dataclass(frozen=True)
class Relative:
    person: Person
    relationship: str
    category: str  # "blood" | "spouse" | "in_law"


def build_relative_list(
    graph: FamilyGraph, persons: dict[uuid.UUID, Person], ego_id: uuid.UUID
) -> list[Relative]:
    results: list[Relative] = []
    seen: set[uuid.UUID] = {ego_id}
    blood_positions: dict[uuid.UUID, tuple[int, int]] = {}

    for person_id, person in persons.items():
        if person_id == ego_id:
            continue
        rel = blood_relation(graph, ego_id, person_id)
        if rel is None:
            continue
        up, down = rel
        label = describe_blood_relation(up, down, person.sex)
        results.append(Relative(person=person, relationship=label, category="blood"))
        blood_positions[person_id] = (up, down)
        seen.add(person_id)

    for spouse_id in graph.spouses_of.get(ego_id, ()):
        person = persons.get(spouse_id)
        if person is None or spouse_id in seen:
            continue
        label = _gendered(person.sex, "husband", "wife", "spouse")
        results.append(Relative(person=person, relationship=label, category="spouse"))
        seen.add(spouse_id)

    # In-laws, pass 1: spouses of ego's blood relatives (sibling's husband,
    # child's wife, etc). Gendered by the in-law's own sex.
    for relative_id, (up, down) in list(blood_positions.items()):
        for spouse_id in graph.spouses_of.get(relative_id, ()):
            if spouse_id in seen:
                continue
            person = persons.get(spouse_id)
            if person is None:
                continue
            label = describe_in_law_via_relative(up, down, person.sex)
            results.append(Relative(person=person, relationship=label, category="in_law"))
            seen.add(spouse_id)

    # In-laws, pass 2: blood relatives of ego's own spouse(s) (mother-in-law,
    # brother-in-law, etc). Gendered by the relative's own sex.
    for spouse_id in graph.spouses_of.get(ego_id, ()):
        for person_id, person in persons.items():
            if person_id in seen:
                continue
            rel = blood_relation(graph, spouse_id, person_id)
            if rel is None:
                continue
            up, down = rel
            label = describe_spouse_relative(up, down, person.sex)
            results.append(Relative(person=person, relationship=label, category="in_law"))
            seen.add(person_id)

    return results


# --- Mutations -------------------------------------------------------------
# Everything below actually writes Relationship rows. Only ever PARENT_OF /
# SPOUSE_OF edges get persisted; every other relationship word used above is
# computed, never stored.


async def _add_parent_edge(
    db: AsyncSession, family_id: uuid.UUID, parent_id: uuid.UUID, child_id: uuid.UUID
) -> None:
    stmt = (
        pg_insert(Relationship)
        .values(family_id=family_id, person_a_id=parent_id, person_b_id=child_id, type="PARENT_OF")
        .on_conflict_do_nothing(constraint="uq_relationship_edge")
    )
    await db.execute(stmt)


async def _add_spouse_edge(
    db: AsyncSession, family_id: uuid.UUID, person_x_id: uuid.UUID, person_y_id: uuid.UUID
) -> None:
    # Undirected: always store with the smaller UUID first so (x, y) and
    # (y, x) can't both be inserted as separate rows.
    a, b = sorted((person_x_id, person_y_id))
    stmt = (
        pg_insert(Relationship)
        .values(family_id=family_id, person_a_id=a, person_b_id=b, type="SPOUSE_OF")
        .on_conflict_do_nothing(constraint="uq_relationship_edge")
    )
    await db.execute(stmt)


async def find_parent_ids(db: AsyncSession, person_id: uuid.UUID) -> list[uuid.UUID]:
    result = await db.execute(
        select(Relationship.person_a_id).where(
            Relationship.type == "PARENT_OF", Relationship.person_b_id == person_id
        )
    )
    return list(result.scalars().all())


async def find_child_ids(db: AsyncSession, person_id: uuid.UUID) -> list[uuid.UUID]:
    result = await db.execute(
        select(Relationship.person_b_id).where(
            Relationship.type == "PARENT_OF", Relationship.person_a_id == person_id
        )
    )
    return list(result.scalars().all())


async def find_spouse_ids(db: AsyncSession, person_id: uuid.UUID) -> list[uuid.UUID]:
    result = await db.execute(
        select(Relationship.person_a_id, Relationship.person_b_id).where(
            Relationship.type == "SPOUSE_OF",
            (Relationship.person_a_id == person_id) | (Relationship.person_b_id == person_id),
        )
    )
    return [b if a == person_id else a for a, b in result.all()]


async def find_claimable_parent(db: AsyncSession, person_id: uuid.UUID) -> Person | None:
    """If person_id has exactly one unclaimed placeholder among their
    existing parents, return it. Used when a real parent joins via invite —
    they should claim that placeholder (and inherit everything already
    connected to it, e.g. an existing sibling) instead of becoming a second,
    disconnected parent. See app.services.invitation_service.accept_invitation."""
    parent_ids = await find_parent_ids(db, person_id)
    if not parent_ids:
        return None
    result = await db.execute(select(Person).where(Person.id.in_(parent_ids)))
    unclaimed = [p for p in result.scalars().all() if not p.is_claimed]
    return unclaimed[0] if len(unclaimed) == 1 else None


async def connect_new_member(
    db: AsyncSession,
    family_id: uuid.UUID,
    inviter_person_id: uuid.UUID,
    new_person_id: uuid.UUID,
    relationship_to_inviter: str,
) -> None:
    """Wires up canonical edges for `new_person_id` based on the single
    relationship label given at invite time. This is what makes "join as my
    sibling" automatically connect to shared parents (and therefore, via the
    read-time traversal above, grandparents/aunts/uncles/cousins too)."""

    if relationship_to_inviter == "child":
        await _add_parent_edge(db, family_id, inviter_person_id, new_person_id)
        for spouse_id in await find_spouse_ids(db, inviter_person_id):
            await _add_parent_edge(db, family_id, spouse_id, new_person_id)

    elif relationship_to_inviter == "parent":
        # Mirror the "spouse" and "child" branches above: a 2nd parent
        # joining shouldn't just link to the inviter — they should also
        # become a spouse of any parent already on record, and a parent of
        # any existing children of that parent (i.e. the inviter's
        # siblings), so a sibling who joined before this parent did doesn't
        # end up connected to only one of their two parents.
        existing_parent_ids = await find_parent_ids(db, inviter_person_id)
        await _add_parent_edge(db, family_id, new_person_id, inviter_person_id)
        for other_parent_id in existing_parent_ids:
            # If new_person_id is claiming an unclaimed placeholder parent
            # (see find_claimable_parent) that's already this same row, skip
            # it — it can't be its own spouse.
            if other_parent_id == new_person_id:
                continue
            await _add_spouse_edge(db, family_id, new_person_id, other_parent_id)
            for sibling_id in await find_child_ids(db, other_parent_id):
                if sibling_id != inviter_person_id:
                    await _add_parent_edge(db, family_id, new_person_id, sibling_id)

    elif relationship_to_inviter == "sibling":
        existing_parent_ids = await find_parent_ids(db, inviter_person_id)
        if existing_parent_ids:
            for parent_id in existing_parent_ids:
                await _add_parent_edge(db, family_id, parent_id, new_person_id)
        else:
            # No parent on record yet — create one unclaimed placeholder so
            # the sibling link is still captured structurally. Whoever joins
            # later as "parent" of either sibling claims this same row
            # instead of creating a duplicate (see app.api.invitations).
            placeholder = Person(
                family_id=family_id,
                first_name="Unknown",
                last_name="Parent",
                is_claimed=False,
            )
            db.add(placeholder)
            await db.flush()
            await _add_parent_edge(db, family_id, placeholder.id, inviter_person_id)
            await _add_parent_edge(db, family_id, placeholder.id, new_person_id)

    elif relationship_to_inviter == "spouse":
        await _add_spouse_edge(db, family_id, inviter_person_id, new_person_id)
        # Mirror the "child" branch above: just as a new child inherits both
        # of the inviter's existing spouses as parents, a new spouse inherits
        # all of the inviter's existing children — otherwise a partner who
        # joins after the kids are already on record ends up linked only to
        # their spouse, not to either child.
        for child_id in await find_child_ids(db, inviter_person_id):
            await _add_parent_edge(db, family_id, new_person_id, child_id)

    else:
        raise ValueError(f"Unknown relationship_to_inviter: {relationship_to_inviter}")
