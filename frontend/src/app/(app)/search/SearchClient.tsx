"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { FamilyMemberReportModal } from "@/components/FamilyMemberReportModal";
import { SearchIcon } from "@/components/icons";
import { EmptyState } from "@/components/EmptyState";
import { SearchIllustration } from "@/components/illustrations/Illustrations";
import { Alert } from "@/components/ui/Alert";
import { inputClass } from "@/components/ui/inputStyles";
import { bucketForDepth, GENERATION_COLOR_VAR, GENERATION_LABEL } from "@/lib/generation";
import { genderLabel } from "@/lib/healthFormat";

import { computeGenerationDepths } from "../tree/familyTreeLayout";
import type { PersonNode } from "../tree/types";

type Props = {
  persons: PersonNode[];
  egoPersonId: string;
};

type HealthSearchResult = {
  person_id: string;
  first_name: string;
  last_name: string;
  sex: "male" | "female" | null;
  age: number | null;
  profile_picture_url: string | null;
  matched_value: string;
};

// Just decides whether it's worth asking the backend to parse the query as
// a health-criteria filter — loose on purpose, since a false positive only
// costs one extra request that comes back `recognized: false` and falls
// straight through to the plain name filter below.
const HEALTH_QUERY_HINT =
  /\d|sugar|glucose|blood\s*pressure|\bbp\b|cholesterol|\bldl\b|\bhdl\b|triglyceride|systolic|diastolic|higher|greater|lower|less than|more than|\babove\b|\bbelow\b|\bover\b|\bunder\b|\bequal\b|condition|disorder|diagnos|suffering/i;

const rowClass =
  "flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm shadow-sm transition-colors hover:bg-surface-muted";

export function SearchClient({ persons, egoPersonId }: Props) {
  const [query, setQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [fetched, setFetched] = useState<{ query: string; results: HealthSearchResult[] } | null>(null);
  const [healthSearchLoading, setHealthSearchLoading] = useState(false);
  const [healthSearchError, setHealthSearchError] = useState<string | null>(null);
  const depths = useMemo(() => computeGenerationDepths(persons, egoPersonId), [persons, egoPersonId]);

  const searchable = useMemo(() => persons.filter((p) => p.is_claimed), [persons]);

  const nameResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return searchable;
    return searchable.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q));
  }, [searchable, query]);

  const trimmedQuery = query.trim();
  const isHealthMode = trimmedQuery.length >= 3 && HEALTH_QUERY_HINT.test(trimmedQuery);

  // Deferred entirely into the debounce timeout below (never called
  // synchronously in the effect body) so this never fires a state update on
  // every keystroke — only once the query settles.
  useEffect(() => {
    if (!isHealthMode) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setHealthSearchLoading(true);
      setHealthSearchError(null);
      try {
        const res = await fetch(`/api/health-records/search?q=${encodeURIComponent(trimmedQuery)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) throw new Error("Could not search health records");
        setFetched(data.recognized ? { query: trimmedQuery, results: data.results } : null);
      } catch {
        if (!cancelled) {
          setFetched(null);
          setHealthSearchError("Couldn't search by health details — try a simpler phrase.");
        }
      } finally {
        if (!cancelled) setHealthSearchLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [isHealthMode, trimmedQuery]);

  // Derived at render time rather than stored, so leaving health-query
  // shape (e.g. deleting back down to a bare name) clears results
  // immediately without a separate effect-driven reset.
  const healthResults = isHealthMode && fetched?.query === trimmedQuery ? fetched.results : null;
  const isHealthSearch = healthResults !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <SearchIcon
          width={18}
          height={18}
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Type a name, or try "siblings with sugar level higher than 300"…'
          aria-label="Search your family by name or health details"
          autoFocus
          className={inputClass(false, "pl-11")}
        />
      </div>

      {isHealthMode && healthSearchLoading && (
        <p className="text-sm text-muted-foreground">Searching health records…</p>
      )}
      {isHealthMode && healthSearchError && <Alert variant="error">{healthSearchError}</Alert>}

      {isHealthSearch ? (
        healthResults.length === 0 ? (
          <EmptyState
            illustration={<SearchIllustration />}
            title="No one matches that"
            description="No family member's shared health details match that description."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {healthResults.map((person) => (
              <li key={person.person_id}>
                <button
                  type="button"
                  onClick={() => setSelectedPersonId(person.person_id)}
                  className={rowClass}
                >
                  <Avatar
                    url={person.profile_picture_url}
                    firstName={person.first_name}
                    lastName={person.last_name}
                    size={44}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {person.first_name} {person.last_name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {genderLabel(person.sex)}
                      {person.age !== null ? ` · ${person.age} years old` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-foreground">
                    {person.matched_value}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : nameResults.length === 0 ? (
        <EmptyState
          illustration={<SearchIllustration />}
          title="No one matches that name"
          description="Double-check the spelling, or browse your whole tree instead."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {nameResults.map((person) => {
            const bucket = bucketForDepth(depths.get(person.person_id) ?? 0, person.is_self);
            const content = (
              <>
                <Avatar
                  url={person.profile_picture_url}
                  firstName={person.first_name}
                  lastName={person.last_name}
                  size={44}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {person.first_name} {person.last_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground capitalize">
                    {person.is_self ? "You" : person.relationship}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-foreground">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: `var(--${GENERATION_COLOR_VAR[bucket]})` }}
                    aria-hidden="true"
                  />
                  {GENERATION_LABEL[bucket]}
                </span>
              </>
            );
            return (
              <li key={person.person_id}>
                {person.is_self ? (
                  <Link href={`/tree?focus=${person.person_id}`} className={rowClass}>
                    {content}
                  </Link>
                ) : (
                  <button type="button" onClick={() => setSelectedPersonId(person.person_id)} className={rowClass}>
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <FamilyMemberReportModal personId={selectedPersonId} onClose={() => setSelectedPersonId(null)} />
    </div>
  );
}
