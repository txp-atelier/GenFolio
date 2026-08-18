"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { FamilyMemberReportModal } from "@/components/FamilyMemberReportModal";
import { AddPersonIcon } from "@/components/icons";
import { EmptyState } from "@/components/EmptyState";
import { TreeSproutIllustration } from "@/components/illustrations/Illustrations";
import { Button } from "@/components/ui/Button";
import { bucketForDepth, GENERATION_COLOR_VAR, GENERATION_LABEL, type GenerationBucket } from "@/lib/generation";

import {
  buildFamilyTreeLayout,
  computeGenerationDepths,
  gridToPxX,
  gridToPxY,
  isUnknownPartnerId,
  NODE_CELL_WIDTH,
  NODE_CELL_HEIGHT,
} from "./familyTreeLayout";
import type { PersonNode } from "./types";

// Cards are inset within their grid cell so generations/siblings have
// breathing room instead of touching edge-to-edge.
const CARD_INSET = 10;

type Props = {
  persons: PersonNode[];
  egoPersonId: string;
  focusPersonId?: string;
};

export function FamilyTreeView({ persons, egoPersonId, focusPersonId }: Props) {
  const byId = useMemo(() => new Map(persons.map((p) => [p.person_id, p] as const)), [persons]);
  const layout = useMemo(() => buildFamilyTreeLayout(persons, egoPersonId), [persons, egoPersonId]);
  const depths = useMemo(() => computeGenerationDepths(persons, egoPersonId), [persons, egoPersonId]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const [highlighted, setHighlighted] = useState<string | null>(focusPersonId ?? null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusPersonId) return;
    const el = nodeRefs.current.get(focusPersonId);
    if (el && scrollRef.current) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      setHighlighted(focusPersonId);
      const timeout = setTimeout(() => setHighlighted(null), 2400);
      return () => clearTimeout(timeout);
    }
  }, [focusPersonId]);

  if (!layout) {
    return (
      <EmptyState
        illustration={<TreeSproutIllustration />}
        title="Your family tree starts with you"
        description="Add your first family member to begin — parents, children, a sibling, or a spouse. We'll take care of connecting everyone else."
        action={
          <Link href="/add">
            <Button>
              <AddPersonIcon width={17} height={17} />
              Add a family member
            </Button>
          </Link>
        }
      />
    );
  }

  const canvasWidth = gridToPxX(layout.canvas.width);
  const canvasHeight = gridToPxY(layout.canvas.height);

  const presentBuckets = new Set<GenerationBucket>();
  for (const p of persons) {
    presentBuckets.add(bucketForDepth(depths.get(p.person_id) ?? 0, p.is_self));
  }
  const bucketOrder: GenerationBucket[] = ["up2", "up1", "peer", "self", "down1", "down2"];
  const hasUnknownCard =
    persons.some((p) => !p.is_claimed) || layout.nodes.some((n) => isUnknownPartnerId(n.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {bucketOrder
          .filter((b) => presentBuckets.has(b))
          .map((bucket) => (
            <span
              key={bucket}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: `var(--${GENERATION_COLOR_VAR[bucket]})` }}
                aria-hidden="true"
              />
              {GENERATION_LABEL[bucket]}
            </span>
          ))}
      </div>

      {hasUnknownCard && (
        <p className="text-xs text-muted-foreground">
          Cards marked <span className="font-medium text-foreground">&quot;Hasn&apos;t joined yet&quot;</span> are
          family members someone has mentioned but who haven&apos;t created an account of their own.
        </p>
      )}

      <div ref={scrollRef} className="custom-scrollbar overflow-auto rounded-3xl border border-border bg-surface p-6 shadow-sm">
        {/* mx-auto (not flex justify-center) so that when the tree is wider
            than the viewport, it sits flush at the left edge instead of
            centering into phantom scrollable blank space on both sides —
            centering only happens when the tree actually fits. */}
        <div className="relative mx-auto" style={{ width: canvasWidth, height: canvasHeight }}>
          <svg className="pointer-events-none absolute inset-0" width={canvasWidth} height={canvasHeight}>
            {layout.connectors.map(([x1, y1, x2, y2], i) => (
              <line
                key={i}
                x1={gridToPxX(x1)}
                y1={gridToPxY(y1)}
                x2={gridToPxX(x2)}
                y2={gridToPxY(y2)}
                stroke="var(--border-strong)"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            ))}
          </svg>

          {layout.nodes.map((node) => {
            const person = byId.get(node.id);
            const bucket = person
              ? bucketForDepth(depths.get(person.person_id) ?? 0, person.is_self)
              : null;
            return (
              <div
                key={node.id}
                ref={(el) => {
                  if (el) nodeRefs.current.set(node.id, el);
                  else nodeRefs.current.delete(node.id);
                }}
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
                    <PersonCard
                      person={person}
                      bucket={bucket!}
                      highlighted={highlighted === node.id}
                      onOpenReport={setSelectedPersonId}
                    />
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

      <FamilyMemberReportModal personId={selectedPersonId} onClose={() => setSelectedPersonId(null)} />
    </div>
  );
}

// Only ever rendered for is_claimed persons — a real, known family member.
function PersonCard({
  person,
  bucket,
  highlighted,
  onOpenReport,
}: {
  person: PersonNode;
  bucket: GenerationBucket;
  highlighted: boolean;
  onOpenReport: (personId: string) => void;
}) {
  const colorVar = `var(--${GENERATION_COLOR_VAR[bucket]})`;

  const content = (
    <>
      <Avatar
        url={person.profile_picture_url}
        firstName={person.first_name}
        lastName={person.last_name}
        size={40}
      />
      <span className="w-full truncate text-xs font-semibold text-foreground">
        {person.first_name} {person.last_name}
      </span>
      <span className="w-full truncate text-[11px] text-muted-foreground capitalize">
        {person.is_self ? "You" : person.relationship}
      </span>
    </>
  );

  const className = `flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-surface px-2 py-2 text-center shadow-sm transition-shadow ${
    highlighted ? "animate-rise-in ring-4 ring-ring ring-offset-2 ring-offset-background" : ""
  }`;
  const style = { borderColor: colorVar };

  if (person.is_self) {
    return (
      <Link href="/profile" className={`${className} hover:shadow-md`} style={style}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenReport(person.person_id)}
      className={`${className} hover:shadow-md`}
      style={style}
    >
      {content}
    </button>
  );
}

// Covers two cases identically: a real backend placeholder (an unclaimed
// structural stand-in the relationship engine created so sibling math still
// works — never shown as if it were a known person) and a purely visual
// placeholder synthesized on the frontend for a lone recorded parent. Neither
// is a real person, so the card says so in plain language instead of just
// "Unknown", which can read like an error.
function UnknownPersonCard() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-border-strong bg-surface-muted px-2 py-2 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-base font-semibold text-muted-foreground">
        ?
      </div>
      <span className="text-xs font-medium text-muted-foreground">Hasn&apos;t joined yet</span>
    </div>
  );
}
