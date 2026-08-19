"use client";

import type { ReactNode } from "react";

import {
  bloodPressureStatus,
  bloodSugarStatus,
  cholesterolStatus,
  VITALS_TONE_BG,
  VITALS_TONE_MUTED_BG,
  VITALS_TONE_TEXT,
  type SugarContext,
  type Unit,
  type VitalsStatus,
  type VitalsTone,
} from "@/lib/vitalsStatus";

type SugarInput = { value: number; unit: Unit; context: SugarContext } | null;
type BloodPressureInput = { systolic: number; diastolic: number } | null;
type CholesterolInput = { total: number; unit: Unit } | null;

type Props = {
  sugar: SugarInput;
  bloodPressure: BloodPressureInput;
  cholesterol: CholesterolInput;
};

const NEUTRAL_TONE = "text-muted-foreground";
const NEUTRAL_BG = "bg-border-strong";

/** The at-a-glance top of the health report — three animated status glyphs
 * (a sugar "molecule" ring, an ECG-style pulse line, a lipid flow gauge)
 * plus a plain-language status line underneath each. Reused unchanged by
 * both the read-only report and the live edit form — the form just feeds
 * it the sliders' current values instead of the saved ones, so the glyphs
 * update as the person drags. */
export function VitalsSummary({ sugar, bloodPressure, cholesterol }: Props) {
  const sugarStatus = sugar ? bloodSugarStatus(sugar.value, sugar.unit, sugar.context) : null;
  const bpStatus = bloodPressure ? bloodPressureStatus(bloodPressure.systolic, bloodPressure.diastolic) : null;
  const cholStatus = cholesterol ? cholesterolStatus(cholesterol.total, cholesterol.unit) : null;

  return (
    <div className="rounded-3xl border border-border bg-surface-muted/60 p-5">
      <div className="grid grid-cols-3 divide-x divide-border">
        <GlyphColumn title="Sugar status">
          <SugarDial tone={sugarStatus?.tone ?? null} />
        </GlyphColumn>
        <GlyphColumn title="Vascular rhythm">
          <PulseWave tone={bpStatus?.tone ?? null} />
        </GlyphColumn>
        <GlyphColumn title="Lipid density">
          <LipidGauge tone={cholStatus?.tone ?? null} />
        </GlyphColumn>
      </div>

      <div className="mt-4 grid grid-cols-3 divide-x divide-border border-t border-border pt-3">
        <StatusCell label="Blood sugar" status={sugarStatus} />
        <StatusCell label="Blood pressure" status={bpStatus} />
        <StatusCell label="Cholesterol" status={cholStatus} />
      </div>
    </div>
  );
}

function GlyphColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-2">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      <div className="flex h-16 items-center justify-center">{children}</div>
    </div>
  );
}

function StatusCell({ label, status }: { label: string; status: VitalsStatus | null }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2 text-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${status ? VITALS_TONE_TEXT[status.tone] : NEUTRAL_TONE}`}>
        {status ? status.label : "Not recorded"}
      </span>
    </div>
  );
}

/** A ring of dots orbiting a center point — reads as "sugar molecules" in
 * circulation. Dots pulse when the reading isn't in the normal range. */
function SugarDial({ tone }: { tone: VitalsTone | null }) {
  const dotColor = tone ? VITALS_TONE_BG[tone] : NEUTRAL_BG;
  const dots = Array.from({ length: 8 });
  return (
    <div className="relative h-16 w-16 shrink-0">
      <div className="absolute inset-0 rounded-full border border-dashed border-border-strong" />
      <div className="vitals-spin absolute inset-0">
        {dots.map((_, i) => {
          const angle = (i / dots.length) * 2 * Math.PI;
          const radius = 26;
          const x = 32 + radius * Math.cos(angle) - 4;
          const y = 32 + radius * Math.sin(angle) - 4;
          return (
            <span
              key={i}
              className={`absolute h-2 w-2 rounded-full ${dotColor} ${
                tone && tone !== "good" ? "vitals-pulse-soft" : ""
              }`}
              style={{ left: x, top: y, animationDelay: `${(i / dots.length) * 1.6}s` }}
            />
          );
        })}
      </div>
      <span className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border-strong" />
    </div>
  );
}

/** A small heartbeat-style trace. Its dashes scroll continuously to read as
 * a live rhythm; color carries the blood-pressure status. */
function PulseWave({ tone }: { tone: VitalsTone | null }) {
  const strokeClass = tone ? VITALS_TONE_TEXT[tone] : NEUTRAL_TONE;
  return (
    <svg viewBox="0 0 120 48" width={112} height={44} fill="none" aria-hidden="true" className={strokeClass}>
      <path
        d="M0 24 H28 L36 8 L44 40 L52 24 H66 L72 14 L78 34 L84 24 H120"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        strokeDasharray="6 4"
        className="vitals-wave"
      />
    </svg>
  );
}

/** White dots flowing left to right through a tone-colored track — two
 * evenly-paced dots for a normal reading, one dot for an abnormal one,
 * whose speed carries the direction: sluggish for low/borderline,
 * urgent for high. No data yet renders as a plain, unanimated track. */
function LipidGauge({ tone }: { tone: VitalsTone | null }) {
  if (!tone) {
    return <div className="h-3.5 w-24 rounded-full bg-border" />;
  }

  const dotCount = tone === "good" ? 2 : 1;
  const speedClass = tone === "alert" ? "vitals-flow-fast" : tone === "caution" ? "vitals-flow-slow" : "vitals-flow";
  const cycleSeconds = tone === "alert" ? 1.1 : tone === "caution" ? 3.6 : 2.2;

  return (
    <div className={`relative h-3.5 w-24 overflow-hidden rounded-full ${VITALS_TONE_MUTED_BG[tone]}`}>
      {Array.from({ length: dotCount }).map((_, i) => (
        <span
          key={i}
          className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-white shadow ${speedClass}`}
          style={{ animationDelay: `${i * (cycleSeconds / dotCount)}s` }}
        />
      ))}
    </div>
  );
}
