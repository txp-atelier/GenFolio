"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/inputStyles";

type CitedRelative = {
  person_id: string;
  first_name: string;
  last_name: string;
  relationship: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  citedRelatives?: CitedRelative[];
};

const SESSION_STORAGE_KEY = "familytree_chat_session_id";

export function ChatClient() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        setMessages(data.map((m) => ({ role: m.role, content: m.content })));
        setSessionId(stored);
      } else {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
      setRestoring(false);
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    setError(null);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, session_id: sessionId }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);

    if (!res.ok) {
      setError(typeof data.detail === "string" ? data.detail : "Could not get a response");
      return;
    }

    if (!sessionId) {
      setSessionId(data.session_id);
      localStorage.setItem(SESSION_STORAGE_KEY, data.session_id);
    }
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: data.answer, citedRelatives: data.cited_relatives },
    ]);
  }

  function handleNewChat() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSessionId(null);
    setMessages([]);
    setError(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col p-4 sm:p-6">
      <div className="flex h-[calc(100vh-9rem)] flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Family health chat</h1>
          <Button type="button" variant="ghost" onClick={handleNewChat} className="px-3 py-1.5 text-xs">
            New chat
          </Button>
        </div>

        <div className="custom-scrollbar flex flex-1 flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-sm">
          {restoring && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!restoring && messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ask about a health condition — e.g. &quot;Why am I bald?&quot; or &quot;Do I have a
              family history of high blood pressure?&quot; Answers are based only on health
              records your blood relatives have logged.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex max-w-[85%] flex-col gap-1 rounded-lg px-3.5 py-2.5 text-sm ${
                m.role === "user"
                  ? "self-end bg-primary text-primary-foreground"
                  : "self-start bg-surface-muted text-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.citedRelatives && m.citedRelatives.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {m.citedRelatives.map((r) => (
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
          ))}
          {sending && <p className="self-start text-sm text-muted-foreground">Thinking...</p>}
          <div ref={bottomRef} />
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a family health pattern..."
            disabled={sending}
            aria-label="Message"
            className={inputClass(false)}
          />
          <Button type="submit" disabled={sending || !input.trim()} className="shrink-0">
            Send
          </Button>
        </form>
      </div>
    </main>
  );
}
