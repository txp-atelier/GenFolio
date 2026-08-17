"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  label?: string;
  children: ReactNode;
};

/** A small "?" affordance for anything that isn't self-explanatory —
 * click or focus to reveal a plain-language explanation. Never the only
 * place a feature is explained, just a shortcut for people who want more. */
export function HelpTooltip({ label = "What does this mean?", children }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border-strong text-[11px] font-bold text-muted-foreground hover:border-ring hover:text-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        ?
      </button>

      {open && (
        <div
          role="tooltip"
          className="animate-rise-in absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-2xl border border-border bg-surface p-3 text-xs leading-relaxed text-foreground shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  );
}
