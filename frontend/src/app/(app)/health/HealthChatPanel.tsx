"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Avatar } from "@/components/Avatar";
import { FamilyMemberReportModal } from "@/components/FamilyMemberReportModal";
import { CloseIcon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/inputStyles";
import { summarizeApiError } from "@/lib/apiError";
import { FetchTimeoutError, fetchWithTimeout } from "@/lib/fetchWithTimeout";
import { genderLabel } from "@/lib/healthFormat";

import type { HealthMatch } from "./types";

type CitedRelative = {
  person_id: string;
  first_name: string;
  last_name: string;
  relationship: string;
};

type Entry =
  | { kind: "chat"; role: "user" | "assistant"; content: string; citedRelatives?: CitedRelative[] }
  | { kind: "matches"; matches: HealthMatch[] };

const SESSION_STORAGE_KEY = "genfolio_chat_session_id";

type Props = {
  onClose?: () => void;
};

/** The old standalone /chat page, folded into the health page as a panel:
 * normal Q&A plus a Compare action that drops the family-match results
 * straight into the same conversation instead of a separate widget. */
export function HealthChatPanel({ onClose }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) {
        setRestoring(false);
        return;
      }
      const res = await fetch(`/api/chat/sessions/${stored}/messages`);
      if (res.ok) {
        const data = (await res.json()) as { role: "user" | "assistant"; content: string }[];
        setEntries(data.map((m) => ({ kind: "chat", role: m.role, content: m.content })));
        setSessionId(stored);
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
      setRestoring(false);
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setEntries((prev) => [...prev, { kind: "chat", role: "user", content: text }]);
    setInput("");
    setSending(true);
    setError(null);

    let res: Response;
    try {
      res = await fetchWithTimeout("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      });
    } catch (err) {
      setSending(false);
      setError(
        err instanceof FetchTimeoutError
          ? "That's taking too long to answer — please try again in a moment."
          : "We couldn't get a response — please try again."
      );
      return;
    }
    const data = await res.json().catch(() => ({}));
    setSending(false);

    if (!res.ok) {
      setError(
        typeof data.detail === "string" ? data.detail : "We couldn't get a response — please try again."
      );
      return;
    }

    if (!sessionId) {
      setSessionId(data.session_id);
      localStorage.setItem(SESSION_STORAGE_KEY, data.session_id);
    }
    setEntries((prev) => [
      ...prev,
      { kind: "chat", role: "assistant", content: data.answer, citedRelatives: data.cited_relatives },
    ]);
  }

  async function handleCompare() {
    if (comparing) return;
    setComparing(true);
    setError(null);

    let res: Response;
    try {
      res = await fetchWithTimeout("/api/health-records/compare");
    } catch (err) {
      setComparing(false);
      setError(
        err instanceof FetchTimeoutError
          ? "That's taking too long — please try again in a moment."
          : "We couldn't compare records — please try again."
      );
      return;
    }
    const data = await res.json().catch(() => ({}));
    setComparing(false);

    if (!res.ok) {
      setError(summarizeApiError(data));
      return;
    }

    const matches = data as HealthMatch[];
    if (matches.length === 0) {
      setEntries((prev) => [
        ...prev,
        {
          kind: "chat",
          role: "assistant",
          content:
            "No matches yet — this needs your health report and a family member's shared report to have some numbers in common.",
        },
      ]);
    } else {
      setEntries((prev) => [...prev, { kind: "matches", matches }]);
    }
  }

  function handleNewChat() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionId(null);
    setEntries([]);
    setError(null);
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-heading truncate text-sm font-bold text-foreground">Family health chat</h2>
          <p className="truncate text-xs text-muted-foreground">Answers use only what your relatives share.</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            loading={comparing}
            onClick={handleCompare}
            className="px-3 py-1.5 text-xs"
          >
            {comparing ? "Comparing…" : "Compare"}
          </Button>
          <Button type="button" variant="ghost" onClick={handleNewChat} className="px-2.5 py-1.5 text-xs">
            New
          </Button>
          {onClose && (
            <button
              type="button"
              aria-label="Close chat"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-foreground lg:hidden"
            >
              <CloseIcon width={16} height={16} />
            </button>
          )}
        </div>
      </div>

      <div className="custom-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {restoring && <p className="text-sm text-muted-foreground">Loading your conversation…</p>}
        {!restoring && entries.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ask about a health condition — e.g. &quot;Why am I bald?&quot; — or tap Compare to see which
            relatives&apos; latest numbers match yours.
          </p>
        )}
        {entries.map((entry, i) =>
          entry.kind === "matches" ? (
            <div
              key={i}
              className="flex w-full max-w-[95%] flex-col gap-2 self-start rounded-2xl bg-surface-muted p-3"
            >
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Family matches
              </p>
              {entry.matches.map((match) => (
                <button
                  key={match.person_id}
                  type="button"
                  onClick={() => setSelectedPersonId(match.person_id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm hover:bg-surface-muted"
                >
                  <Avatar
                    url={match.profile_picture_url}
                    firstName={match.first_name}
                    lastName={match.last_name}
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {match.first_name} {match.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {genderLabel(match.sex)}
                      {match.age !== null ? ` · ${match.age} years old` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-surface-muted px-2 py-1 text-xs font-semibold text-foreground">
                    {match.match_percentage}%
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div
              key={i}
              className={`flex max-w-[85%] flex-col gap-1 rounded-2xl px-3.5 py-2.5 text-sm ${
                entry.role === "user"
                  ? "self-end bg-primary text-primary-foreground"
                  : "self-start bg-surface-muted text-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap">{entry.content}</p>
              {entry.citedRelatives && entry.citedRelatives.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {entry.citedRelatives.map((r) => (
                    <span
                      key={r.person_id}
                      className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {r.first_name} {r.last_name} ({r.relationship})
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        )}
        {sending && <p className="self-start text-sm text-muted-foreground">Thinking…</p>}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="px-4 pb-2">
          <Alert variant="error">{error}</Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-border p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a family health pattern…"
          disabled={sending}
          aria-label="Message"
          className={inputClass(false)}
        />
        <Button type="submit" disabled={sending || !input.trim()} className="shrink-0">
          Send
        </Button>
      </form>

      <FamilyMemberReportModal personId={selectedPersonId} onClose={() => setSelectedPersonId(null)} />
    </div>
  );
}
