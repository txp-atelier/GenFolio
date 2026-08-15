"use client";

import { useState } from "react";

import { Dropdown, type DropdownOption } from "@/components/Dropdown";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const RELATIONSHIP_OPTIONS: DropdownOption[] = [
  { value: "parent", label: "Parent" },
  { value: "child", label: "Child" },
  { value: "sibling", label: "Sibling" },
  { value: "spouse", label: "Spouse" },
];

export function InviteForm() {
  const [relationship, setRelationship] = useState<string>("sibling");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
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
      setError(typeof data.detail === "string" ? data.detail : "Could not create invite");
      return;
    }
    setInviteUrl(data.invite_url);
  }

  function handleRelationshipChange(next: string) {
    setRelationship(next);
    setInviteUrl(null);
    setError(null);
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Invite a family member</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick how they relate to you — parents, grandparents, and other connections are figured
          out automatically from there.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Dropdown
            label="They are my..."
            required
            options={RELATIONSHIP_OPTIONS}
            value={relationship}
            onChange={handleRelationshipChange}
          />
        </div>
        <Button onClick={handleGenerate} loading={submitting} className="shrink-0">
          Generate invite link
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {inviteUrl && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-muted p-3">
          <p className="text-sm break-all text-foreground">{inviteUrl}</p>
          <Button variant="secondary" onClick={handleCopy} className="self-start px-3 py-1.5 text-xs">
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      )}
    </Card>
  );
}
