"use client";

import { useState, type ReactNode } from "react";

import { CopyIcon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { useUser } from "@/lib/UserContext";

type RelationshipValue = "parent" | "child" | "sibling" | "spouse";

function ParentGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="16" r="4" />
      <path d="M12 12V4M8 8l4-4 4 4" />
    </svg>
  );
}

function ChildGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M12 12v8M8 16l4 4 4-4" />
    </svg>
  );
}

function SiblingGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="12" r="6.5" />
      <circle cx="15" cy="12" r="6.5" fillOpacity="0.55" />
    </svg>
  );
}

function SpouseGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6Z" />
    </svg>
  );
}

const RELATIONSHIP_OPTIONS: {
  value: RelationshipValue;
  label: string;
  description: string;
  colorVar: string;
  glyph: ReactNode;
}[] = [
  { value: "parent", label: "Parent", description: "A mother, father, or step-parent", colorVar: "gen-up1", glyph: <ParentGlyph /> },
  { value: "child", label: "Child", description: "A son, daughter, or step-child", colorVar: "gen-down1", glyph: <ChildGlyph /> },
  { value: "sibling", label: "Sibling", description: "A brother or sister", colorVar: "gen-peer", glyph: <SiblingGlyph /> },
  { value: "spouse", label: "Spouse", description: "A husband, wife, or partner", colorVar: "gen-peer", glyph: <SpouseGlyph /> },
];

export function AddPersonForm() {
  const me = useUser();
  const [relationship, setRelationship] = useState<RelationshipValue | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    if (!relationship) return;
    setSubmitting(true);
    setError(null);
    setCopied(false);

    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relationship_to_inviter: relationship }),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (!res.ok) {
      setError(
        typeof data.detail === "string"
          ? data.detail
          : "We couldn't create the link — please try again."
      );
      return;
    }
    setInviteUrl(data.invite_url);
  }

  function selectRelationship(next: RelationshipValue) {
    setRelationship(next);
    setInviteUrl(null);
    setError(null);
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
  }

  async function handleShare() {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join our family on GenFolio", url: inviteUrl });
      } catch {
        // User canceled the share sheet — nothing to do.
      }
    } else {
      handleCopy();
    }
  }

  const selected = RELATIONSHIP_OPTIONS.find((o) => o.value === relationship);

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">This person is my…</p>
          <HelpTooltip label="Why do I send a link instead of typing their details?">
            Everyone manages their own profile and health information, so we ask each person to join
            with their own login. That keeps their details private and accurate — and once they join,
            we connect them to your tree automatically.
          </HelpTooltip>
        </div>

        <div role="radiogroup" aria-label="Relationship to you" className="grid grid-cols-2 gap-3">
          {RELATIONSHIP_OPTIONS.map((option) => {
            const isSelected = option.value === relationship;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => selectRelationship(option.value)}
                className={`flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isSelected ? "border-transparent bg-surface-muted shadow-sm" : "border-border bg-surface hover:bg-surface-muted"
                }`}
                style={isSelected ? { boxShadow: `inset 0 0 0 2px var(--${option.colorVar})` } : undefined}
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                  style={{ background: `var(--${option.colorVar})` }}
                >
                  {option.glyph}
                </span>
                <span className="font-heading text-sm font-semibold text-foreground">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </button>
            );
          })}
        </div>

        <Button onClick={handleGenerate} loading={submitting} disabled={!relationship} className="self-start">
          {submitting ? "Creating your link…" : "Create invite link"}
        </Button>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {inviteUrl && selected && (
        <Card className="animate-rise-in flex flex-col gap-3">
          <p className="text-sm text-foreground">
            <span className="font-semibold">Send this link</span> to your {selected.label.toLowerCase()} — text,
            email, or however you&apos;d like. When they open it, they&apos;ll create their own login and
            we&apos;ll add them to {me.family_name}&apos;s tree as your {selected.label.toLowerCase()}.
          </p>
          <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface-muted p-3">
            <p className="text-sm break-all text-foreground">{inviteUrl}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleCopy} className="px-4 py-2 text-xs">
                <CopyIcon width={14} height={14} />
                {copied ? "Copied!" : "Copy link"}
              </Button>
              <Button variant="secondary" onClick={handleShare} className="px-4 py-2 text-xs">
                Share…
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
