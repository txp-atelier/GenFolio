"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { Dropdown, type DropdownOption } from "@/components/Dropdown";
import { formatDateDMY } from "@/lib/formatDate";

import { FormField } from "./FormField";

type Props = {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  maxDate?: Date;
  minDate?: Date;
  disabled?: boolean;
  placeholder?: string;
};

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Panel is capped at max-h-80 (20rem = 320px); used to decide whether it
// still fits below the trigger or needs to flip above it.
const PANEL_MAX_HEIGHT_PX = 320;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isDateOutOfRange(date: Date, minDate?: Date, maxDate?: Date): boolean {
  const day = startOfDay(date);
  if (maxDate && day > startOfDay(maxDate)) return true;
  if (minDate && day < startOfDay(minDate)) return true;
  return false;
}

// Inserts "/" after the day and month digit pairs as the user types, so
// typing "23082026" reads back as "23/08/2026" without them having to key
// the slashes themselves.
function autoSlashDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += "/" + digits.slice(2, 4);
  if (digits.length > 4) out += "/" + digits.slice(4, 8);
  return out;
}

// Parses a complete 8-digit DDMMYYYY string into a real calendar date,
// rejecting anything that overflows (e.g. day 31 in a 30-day month) rather
// than silently rolling into the next month the way `new Date` normally
// would.
function parseTypedDigits(digits: string): Date | null {
  if (digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (month < 1 || month > 12 || day < 1) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function DateField({
  label,
  required,
  error,
  hint,
  value,
  onChange,
  maxDate,
  minDate,
  disabled,
  placeholder = "DD/MM/YYYY",
}: Props) {
  const selected = parseISODate(value);
  const today = new Date();

  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const [viewYear, setViewYear] = useState((selected ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState((selected ?? today).getMonth());
  const [text, setText] = useState(selected ? formatDateDMY(selected) : "");
  const [typedError, setTypedError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  // Re-sync the visible month/year/typed text whenever the underlying value
  // changes from outside (e.g. form reset, or a day picked in the panel)
  // without fighting the user's own in-progress typing or panel navigation.
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    const base = parseISODate(value);
    setViewYear((base ?? today).getFullYear());
    setViewMonth((base ?? today).getMonth());
    setText(base ? formatDateDMY(base) : "");
    setTypedError(null);
  }

  function handleToggle() {
    if (disabled) return;
    if (!open && toggleButtonRef.current) {
      const rect = toggleButtonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUpward(spaceBelow < PANEL_MAX_HEIGHT_PX && spaceAbove > spaceBelow);
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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

  function handleTextChange(e: ChangeEvent<HTMLInputElement>) {
    const formatted = autoSlashDate(e.target.value);
    setText(formatted);
    setTypedError(null);

    const digits = formatted.replace(/\D/g, "");
    if (digits.length === 0) {
      onChange("");
      return;
    }
    if (digits.length < 8) return; // still typing — don't touch the committed value yet

    const parsed = parseTypedDigits(digits);
    if (!parsed) {
      setTypedError("Enter a valid date");
      return;
    }
    if (isDateOutOfRange(parsed, minDate, maxDate)) {
      setTypedError(
        maxDate && startOfDay(parsed) > startOfDay(maxDate)
          ? "That date can't be in the future"
          : "That date is out of range"
      );
      return;
    }
    onChange(toISODate(parsed));
  }

  function handleTextBlur() {
    // Discard an incomplete or invalid in-progress edit — snap the display
    // back to whatever was last actually committed.
    setText(selected ? formatDateDMY(selected) : "");
    setTypedError(null);
  }

  // Enter in a plain <input> natively submits its enclosing <form> — commit
  // the typed date (via blur) instead of letting that implicit submit
  // through, so finishing a date never itself saves the form.
  function handleTextKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  const maxYear = (maxDate ?? new Date(today.getFullYear() + 10, 0, 1)).getFullYear();
  const minYear = (minDate ?? new Date(today.getFullYear() - 120, 0, 1)).getFullYear();
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);

  const monthOptions: DropdownOption[] = MONTH_LABELS.map((m, i) => ({ value: String(i), label: m }));
  const yearOptions: DropdownOption[] = years.map((y) => ({ value: String(y), label: String(y) }));

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysCount = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysCount }, (_, i) => i + 1),
  ];

  function isDayDisabled(day: number): boolean {
    return isDateOutOfRange(new Date(viewYear, viewMonth, day), minDate, maxDate);
  }

  function selectDay(day: number) {
    onChange(toISODate(new Date(viewYear, viewMonth, day)));
    setOpen(false);
    inputRef.current?.focus();
  }

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  const hasError = !!error || !!typedError;

  const trigger = (
    <div className="relative" ref={rootRef}>
      <div
        className={`flex w-full min-w-0 items-center gap-2 rounded-2xl border bg-surface pr-2 pl-4 text-sm text-foreground focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-background ${
          hasError
            ? "border-danger-border focus-within:border-danger focus-within:ring-danger"
            : "border-border focus-within:border-ring focus-within:ring-ring"
        } ${disabled ? "cursor-not-allowed bg-surface-muted opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={text}
          onChange={handleTextChange}
          onBlur={handleTextBlur}
          onKeyDown={handleTextKeyDown}
          onFocus={(e) => e.currentTarget.select()}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={10}
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent py-3 text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed"
        />
        <button
          ref={toggleButtonRef}
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          aria-label="Open calendar"
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            className="shrink-0"
          >
            <rect x="3" y="4.5" width="18" height="16" rx="2" />
            <path d="M3 9.5h18M8 3v3M16 3v3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date"
          className={`absolute z-10 w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-surface p-3 shadow-lg ${
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <div className="mb-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={goToPrevMonth}
              aria-label="Previous month"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="min-w-0 flex-1">
              <Dropdown
                ariaLabel="Month"
                options={monthOptions}
                value={String(viewMonth)}
                onChange={(v) => setViewMonth(Number(v))}
              />
            </div>

            <div className="w-28 shrink-0">
              <Dropdown
                ariaLabel="Year"
                options={yearOptions}
                value={String(viewYear)}
                onChange={(v) => setViewYear(Number(v))}
              />
            </div>

            <button
              type="button"
              onClick={goToNextMonth}
              aria-label="Next month"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {WEEKDAY_LABELS.map((d, i) => (
              <div key={i} className="py-1 font-medium">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} />;
              const cellDate = new Date(viewYear, viewMonth, day);
              const isSelected = selected ? isSameDay(selected, cellDate) : false;
              const isToday = isSameDay(today, cellDate);
              const blocked = isDayDisabled(day);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(day)}
                  disabled={blocked}
                  className={`flex h-8 w-8 items-center justify-center rounded-md text-sm disabled:cursor-not-allowed ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : blocked
                        ? "text-muted-foreground/40"
                        : "text-foreground hover:bg-surface-muted"
                  } ${isToday && !isSelected ? "font-semibold text-primary" : ""}`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {selected && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="mt-2 w-full rounded-md px-2 py-1.5 text-center text-xs font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );

  const combinedError = error || typedError || undefined;

  if (!label) return trigger;

  return (
    <FormField label={label} required={required} error={combinedError} hint={hint}>
      {trigger}
    </FormField>
  );
}
