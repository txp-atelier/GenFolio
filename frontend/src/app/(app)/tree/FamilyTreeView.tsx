"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Avatar } from "@/components/Avatar";

import {
  buildFamilyTreeLayout,
  gridToPxX,
  gridToPxY,
  isUnknownPartnerId,
  NODE_CELL_WIDTH,
  NODE_CELL_HEIGHT,
} from "./familyTreeLayout";
import type { PersonNode } from "./types";

// Cards are inset within their grid cell so generations/siblings have
// breathing room instead of touching edge-to-edge.
const CARD_INSET = 12;

type Props = {
  persons: PersonNode[];
  egoPersonId: string;
};

export function FamilyTreeView({ persons, egoPersonId }: Props) {
  const byId = useMemo(() => new Map(persons.map((p) => [p.person_id, p] as const)), [persons]);
  const layout = useMemo(() => buildFamilyTreeLayout(persons, egoPersonId), [persons, egoPersonId]);

  if (!layout) {
    return (
      <p className="text-sm text-muted-foreground">
        No relatives connected yet — invite someone from the dashboard.
      </p>
    );
  }

  const canvasWidth = gridToPxX(layout.canvas.width);
  const canvasHeight = gridToPxY(layout.canvas.height);

  return (
    <div className="custom-scrollbar overflow-auto rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex min-w-full justify-center">
        <div className="relative shrink-0" style={{ width: canvasWidth, height: canvasHeight }}>
          <svg className="pointer-events-none absolute inset-0" width={canvasWidth} height={canvasHeight}>
            {layout.connectors.map(([x1, y1, x2, y2], i) => (
              <line
                key={i}
                x1={gridToPxX(x1)}
                y1={gridToPxY(y1)}
                x2={gridToPxX(x2)}
                y2={gridToPxY(y2)}
                stroke="var(--border-strong)"
                strokeWidth={2}
              />
            ))}
          </svg>

          {layout.nodes.map((node) => {
            const person = byId.get(node.id);
            return (
              <div
                key={node.id}
                className="absolute"
                style={{
                  left: gridToPxX(node.left) + CARD_INSET,
                  top: gridToPxY(node.top) + CARD_INSET,
                  width: NODE_CELL_WIDTH - CARD_INSET * 2,
                  height: NODE_CELL_HEIGHT - CARD_INSET * 2,
                }}
              >
                {person ? (
                  person.is_claimed ? (
                    <PersonCard person={person} />
                  ) : (
                    <UnknownPersonCard />
                  )
                ) : isUnknownPartnerId(node.id) ? (
                  <UnknownPersonCard />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Only ever rendered for is_claimed persons — a real, known family member.
function PersonCard({ person }: { person: PersonNode }) {
  const content = (
    <>
      <Avatar
        url={person.profile_picture_url}
        firstName={person.first_name}
        lastName={person.last_name}
        size={36}
      />
      <span className="w-full truncate text-xs font-medium text-foreground">
        {person.first_name} {person.last_name}
      </span>
      <span className="w-full truncate text-[11px] text-muted-foreground capitalize">
        {person.is_self ? "You" : person.relationship}
      </span>
    </>
  );

  const className = `flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg border bg-surface px-2 py-2 text-center ${
    person.is_self ? "border-2 border-primary" : "border-border"
  }`;

  if (person.is_self) {
    return (
      <Link href="/profile" className={`${className} transition-colors hover:bg-surface-muted`}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

// Covers two cases identically: a real backend placeholder (an unclaimed
// structural stand-in the relationship engine created so sibling math still
// works — never shown as if it were a known person) and a purely visual
// placeholder synthesized on the frontend for a lone recorded parent. Either
// way, nothing about them is real, so nothing but "?" is shown.
function UnknownPersonCard() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong bg-surface-muted px-2 py-2 text-center">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-base font-semibold text-muted-foreground">
        ?
      </div>
      <span className="text-xs font-medium text-muted-foreground">Unknown</span>
    </div>
  );
}
