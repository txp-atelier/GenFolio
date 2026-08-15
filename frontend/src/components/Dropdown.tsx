"use client";

import { useEffect, useRef, useState } from "react";

import { FormField } from "./ui/FormField";

export type DropdownOption = {
  value: string;
  label: string;
  group?: string;
  description?: string;
};

type DropdownProps = {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  ariaLabel?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  disabled?: boolean;
};

// Panel is capped at max-h-72 (18rem = 288px); used to decide whether it
// still fits below the trigger or needs to flip above it.
const PANEL_MAX_HEIGHT_PX = 288;

export function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Select...",
  label,
  ariaLabel,
  required,
  error,
  hint,
  disabled,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function handleToggle() {
    if (disabled) return;
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Flip upward only when there's genuinely more room above than below
      // and below can't comfortably fit the panel — avoids flipping in a
      // tall viewport just because the panel happens to be capped short.
      setOpenUpward(spaceBelow < PANEL_MAX_HEIGHT_PX && spaceAbove > spaceBelow);
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
  }, []);

  const selected = options.find((o) => o.value === value);

  const groups: { name: string | undefined; items: DropdownOption[] }[] = [];
  for (const opt of options) {
    const last = groups[groups.length - 1];
    if (last && last.name === opt.group) {
      last.items.push(opt);
    } else {
      groups.push({ name: opt.group, items: [opt] });
    }
  }

  const trigger = (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-surface px-3.5 py-2.5 text-left text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60 ${
          error ? "border-danger-border focus:border-danger focus:ring-danger" : "border-border focus:border-primary focus:ring-primary"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label ? undefined : ariaLabel}
      >
        <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className={`custom-scrollbar absolute z-10 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-surface py-1 shadow-lg ${
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {groups.map((group, i) => (
            <div key={i}>
              {group.name && (
                <div className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group.name}
                </div>
              )}
              {group.items.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-muted ${
                    opt.value === value ? "bg-surface-muted" : ""
                  }`}
                >
                  <span className="flex flex-col">
                    <span className="text-foreground">{opt.label}</span>
                    {opt.description && (
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    )}
                  </span>
                  {opt.value === value && (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="mt-0.5 shrink-0 text-primary"
                    >
                      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!label) return trigger;

  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      {trigger}
    </FormField>
  );
}
