"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { VITALS_TONE_TEXT, type VitalsTone } from "@/lib/vitalsStatus";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  tone: VitalsTone;
  onChange: (value: number) => void;
  unit: string;
  formatNumber: (value: number) => string;
  valuePrefix?: string;
  statusLabel?: string;
  error?: string;
  trailing?: ReactNode;
  help?: ReactNode;
};

const TONE_BORDER: Record<VitalsTone, string> = {
  good: "border-success-border focus-within:border-success focus-within:ring-success",
  caution: "border-warning-border focus-within:border-warning focus-within:ring-warning",
  alert: "border-danger-border focus-within:border-danger focus-within:ring-danger",
};

function snapToStep(value: number, min: number, step: number): number {
  const snapped = min + Math.round((value - min) / step) * step;
  return Math.round(snapped * 1000) / 1000;
}

/** One plain number-entry row for a vital: label (+ optional "?" tooltip and
 * unit toggle), a single tone-tinted number input, and a status label /
 * error underneath — the building block the report's edit form uses for
 * blood sugar, systolic, diastolic, and cholesterol. Replaces the old
 * slider-plus-click-to-edit control with just one always-editable box. */
export function VitalsNumberField({
  label,
  value,
  min,
  max,
  step = 1,
  tone,
  onChange,
  unit,
  formatNumber,
  valuePrefix,
  statusLabel,
  error,
  trailing,
  help,
}: Props) {
  const [draft, setDraft] = useState(formatNumber(value));
  const [editError, setEditError] = useState<string | null>(null);
  const focused = useRef(false);

  useEffect(() => {
    // Only sync from outside while the field isn't focused — otherwise a
    // parent re-render (e.g. from unit conversion) would fight the user's
    // in-progress typing.
    if (!focused.current) setDraft(formatNumber(value));
  }, [value, formatNumber]);

  useEffect(() => {
    if (!editError) return;
    const timer = setTimeout(() => setEditError(null), 3000);
    return () => clearTimeout(timer);
  }, [editError]);

  function commit() {
    const parsed = Number(draft);
    if (draft.trim() === "" || Number.isNaN(parsed)) {
      setEditError("Enter a valid number");
      setDraft(formatNumber(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    if (clamped !== parsed) {
      setEditError(`Enter a value between ${formatNumber(min)} and ${formatNumber(max)}`);
    }
    onChange(snapToStep(clamped, min, step));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {label}
          {help && <HelpTooltip label={`About ${label.toLowerCase()}`}>{help}</HelpTooltip>}
        </span>
        {trailing}
      </div>

      <div
        className={`flex items-center gap-2 rounded-2xl border bg-surface px-4 py-3 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-background ${TONE_BORDER[tone]}`}
      >
        {valuePrefix && <span className="shrink-0 text-sm font-medium text-muted-foreground">{valuePrefix}</span>}
        <input
          type="number"
          inputMode="decimal"
          value={draft}
          aria-label={label}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => {
            focused.current = true;
            e.currentTarget.select();
          }}
          onBlur={() => {
            focused.current = false;
            commit();
          }}
          onKeyDown={handleKeyDown}
          className="w-full min-w-0 bg-transparent text-sm font-semibold text-foreground focus:outline-none"
        />
        <span className="shrink-0 text-sm text-muted-foreground">{unit}</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs font-semibold ${statusLabel ? VITALS_TONE_TEXT[tone] : ""}`}>
          {statusLabel || " "}
        </span>
      </div>

      {editError && (
        <p className="text-xs text-danger" role="alert">
          {editError}
        </p>
      )}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
