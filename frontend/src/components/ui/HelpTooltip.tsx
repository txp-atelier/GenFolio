"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  label?: string;
  children: ReactNode;
};

// Rough ceiling for the popup's rendered height, used only to decide
// whether it fits below the trigger before flipping upward — doesn't need
// to be exact, just enough to avoid the sticky navbar most fields sit
// close to.
const POPUP_MAX_HEIGHT_PX = 260;

/** A small "?" affordance for anything that isn't self-explanatory —
 * click or focus to reveal a plain-language explanation. Never the only
 * place a feature is explained, just a shortcut for people who want more.
 * Opens downward by default and only flips above the trigger when there's
 * genuinely more room there — opening upward unconditionally used to run
 * the popup straight into the app's sticky navbar for any field near the
 * top of the page. */
export function HelpTooltip({ label = "What does this mean?", children }: Props) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleToggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUpward(spaceBelow < POPUP_MAX_HEIGHT_PX && spaceAbove > spaceBelow);
    }
    setOpen((v) => !v);
  }

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
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={handleToggle}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border-strong text-[11px] font-bold text-muted-foreground hover:border-ring hover:text-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        ?
      </button>

      {open && (
        <div
          role="tooltip"
          className={`animate-rise-in absolute left-1/2 z-3 w-64 -translate-x-1/2 rounded-2xl border border-border bg-surface p-3 text-xs leading-relaxed text-foreground shadow-lg ${
            openUpward ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
