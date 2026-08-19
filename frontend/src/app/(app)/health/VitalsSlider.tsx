"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { Slider } from "@/components/ui/Slider";
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

function snapToStep(value: number, min: number, step: number): number {
  const snapped = min + Math.round((value - min) / step) * step;
  return Math.round(snapped * 1000) / 1000;
}

/** One draggable vitals row: label (+ optional "?" tooltip and unit
 * toggle), a tone-colored slider, and a status label / numeric readout
 * underneath — the building block the report's edit form uses for blood
 * sugar, systolic, diastolic, and cholesterol. The readout doubles as a
 * text field: click it to type an exact value instead of dragging. */
export function VitalsSlider({
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (!editError) return;
    const timer = setTimeout(() => setEditError(null), 3000);
    return () => clearTimeout(timer);
  }, [editError]);

  function startEditing() {
    setDraft(formatNumber(value));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const parsed = Number(draft);
    if (draft.trim() === "" || Number.isNaN(parsed)) {
      setEditError("Enter a valid number");
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
      commit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setEditing(false);
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
      <Slider value={value} min={min} max={max} step={step} tone={tone} onChange={onChange} ariaLabel={label} />
      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs font-semibold ${statusLabel ? VITALS_TONE_TEXT[tone] : ""}`}>
          {statusLabel || " "}
        </span>
        {editing ? (
          <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
            {valuePrefix}
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={handleKeyDown}
              onFocus={(e) => e.currentTarget.select()}
              className="w-20 rounded-lg border border-border-strong bg-surface px-2 py-0.5 text-right text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-muted-foreground">{unit}</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="rounded-lg px-1 text-sm font-semibold text-foreground hover:bg-surface-muted"
          >
            {valuePrefix}
            {formatNumber(value)} {unit}
          </button>
        )}
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
