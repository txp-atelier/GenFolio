"use client";

import type { VitalsTone } from "@/lib/vitalsStatus";

type Props = {
  value: number;
  min: number;
  max: number;
  step?: number;
  tone: VitalsTone;
  onChange: (value: number) => void;
  ariaLabel: string;
  disabled?: boolean;
};

// Native `accent-color` recolors both the thumb and the filled portion of
// the track in every current browser — no pseudo-element hacking needed to
// get a tone-colored slider.
const TONE_ACCENT: Record<VitalsTone, string> = {
  good: "accent-success",
  caution: "accent-warning",
  alert: "accent-danger",
};

export function Slider({ value, min, max, step = 1, tone, onChange, ariaLabel, disabled }: Props) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`h-2 w-full cursor-pointer rounded-full bg-border transition-colors ${TONE_ACCENT[tone]} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60`}
    />
  );
}
