import calcTree from "relatives-tree";

import type { PersonNode } from "./types";

type TreeCalc = typeof calcTree;
type TreeInputNode = Parameters<TreeCalc>[0][number];
export type TreeResult = ReturnType<TreeCalc>;
export type TreeExtNode = TreeResult["nodes"][number];
export type TreeConnector = TreeResult["connectors"][number];

// One grid cell = one person card. relatives-tree positions everything on a
// grid where each unit is half a card (so a couple's two cards sit flush
// next to each other) — these are the pixel dimensions of that card. Tall
// enough that a 4-line card (avatar, name, relationship, "not yet joined")
// never has to overflow its cell and bleed into the connector lines above it.
export const NODE_CELL_WIDTH = 172;
export const NODE_CELL_HEIGHT = 158;

export function gridToPxX(v: number): number {
  return v * (NODE_CELL_WIDTH / 2);
}

export function gridToPxY(v: number): number {
  return v * (NODE_CELL_HEIGHT / 2);
}

type MutableRelation = { id: string; type: string };
type MutableNode = {
  id: string;
  gender: string;
  parents: MutableRelation[];
  children: MutableRelation[];
  siblings: MutableRelation[];
  spouses: MutableRelation[];
  placeholder?: boolean;
};

const UNKNOWN_PARTNER_PREFIX = "unknown-partner-of-";

export function isUnknownPartnerId(id: string): boolean {
  return id.startsWith(UNKNOWN_PARTNER_PREFIX);
}

/** Every real person plus one synthetic "Unknown" partner for any parent who
 * has exactly one child-bearing partner on record. This is what makes a
 * lone recorded parent still render as a two-box couple with a single arrow
 * down to their child — it only ever fills in the ONE missing partner next
 * to a parent we already know about, it never invents earlier generations. */
function buildNodes(persons: PersonNode[]): MutableNode[] {
  const nodes = new Map<string, MutableNode>();
  for (const p of persons) {
    nodes.set(p.person_id, {
      id: p.person_id,
      // Gender only affects which side of a couple a node sorts to, purely
      // cosmetic — persons with no recorded sex default to "male".
      gender: p.sex === "female" ? "female" : "male",
      parents: p.parent_ids.map((id) => ({ id, type: "blood" })),
      children: p.child_ids.map((id) => ({ id, type: "blood" })),
      siblings: [],
      spouses: p.spouse_ids.map((id) => ({ id, type: "married" })),
    });
  }

  // Pass 1: find every lone parent — recorded as the ONLY parent of at
  // least one child, with no recorded spouse of their own — based on the
  // original (unmutated) parent_ids, so a parent with several children is
  // only ever judged "lone" once, consistently.
  const loneParentIds = new Set<string>();
  for (const p of persons) {
    if (p.parent_ids.length !== 1) continue;
    const parentNode = nodes.get(p.parent_ids[0]);
    if (parentNode && parentNode.spouses.length === 0) loneParentIds.add(p.parent_ids[0]);
  }

  // Pass 2: give each lone parent exactly one synthetic "Unknown" partner.
  const syntheticIdByParent = new Map<string, string>();
  for (const parentId of loneParentIds) {
    const parentNode = nodes.get(parentId)!;
    const syntheticId = `${UNKNOWN_PARTNER_PREFIX}${parentId}`;
    syntheticIdByParent.set(parentId, syntheticId);
    nodes.set(syntheticId, {
      id: syntheticId,
      gender: parentNode.gender === "female" ? "male" : "female",
      parents: [],
      children: [],
      siblings: [],
      spouses: [{ id: parentId, type: "married" }],
      placeholder: true,
    });
    parentNode.spouses.push({ id: syntheticId, type: "married" });
  }

  // Pass 3: attach that synthetic partner to EVERY child of the lone
  // parent, not just the first one encountered — otherwise siblings end up
  // with different-sized parent units and the couple stops rendering as one.
  for (const p of persons) {
    if (p.parent_ids.length !== 1) continue;
    const syntheticId = syntheticIdByParent.get(p.parent_ids[0]);
    if (!syntheticId) continue;
    nodes.get(syntheticId)!.children.push({ id: p.person_id, type: "blood" });
    nodes.get(p.person_id)!.parents.push({ id: syntheticId, type: "blood" });
  }

  return [...nodes.values()];
}

export function buildFamilyTreeLayout(persons: PersonNode[], rootId: string): TreeResult | null {
  if (persons.length <= 1 || !persons.some((p) => p.person_id === rootId)) return null;
  // Cast once here: relatives-tree's Node type declares `gender`/relation
  // `type` as const enums, which can't be imported as values under
  // isolatedModules, so we build plain string-valued objects instead.
  const nodes = buildNodes(persons) as unknown as TreeInputNode[];
  return calcTree(nodes, { rootId });
}

/** How many generations "up" (negative, toward ancestors) or "down"
 * (positive, toward descendants) each person sits from the ego, via a BFS
 * that treats a parent edge as -1, a child edge as +1, and a spouse edge as
 * 0. This is what lets the tree color-code every card by generation instead
 * of requiring the viewer to read relationship labels to understand the
 * shape of the family. */
export function computeGenerationDepths(persons: PersonNode[], egoId: string): Map<string, number> {
  const byId = new Map(persons.map((p) => [p.person_id, p] as const));
  const depths = new Map<string, number>();
  if (!byId.has(egoId)) return depths;

  depths.set(egoId, 0);
  const queue: string[] = [egoId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const person = byId.get(id);
    if (!person) continue;
    const depth = depths.get(id)!;

    const steps: [string[], number][] = [
      [person.parent_ids, depth - 1],
      [person.child_ids, depth + 1],
      [person.spouse_ids, depth],
    ];
    for (const [ids, nextDepth] of steps) {
      for (const neighborId of ids) {
        if (!depths.has(neighborId)) {
          depths.set(neighborId, nextDepth);
          queue.push(neighborId);
        }
      }
    }
  }
  return depths;
}
