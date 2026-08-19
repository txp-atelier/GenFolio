/** Client-side classification of vitals into a small set of severity tones
 * + human labels, driving the color and animation of the vitals summary
 * widgets on the health report. Cut points are pinned to the same
 * mg/dL-based thresholds health_record_service.py already uses for its
 * "high/low/normal" chat filters (_DEFAULT_QUALIFIER_THRESHOLD), extended
 * with the intermediate bands — pre-diabetic, AHA blood-pressure stages,
 * borderline cholesterol — a full report needs but a one-shot chat filter
 * doesn't. */

export type VitalsTone = "good" | "caution" | "alert";

export type VitalsStatus = { tone: VitalsTone; label: string };

export type Unit = "mg/dL" | "mmol/L";
export type SugarContext = "" | "fasting" | "post_meal" | "random";

// 1 mmol/L glucose ~= 18.0182 mg/dL (matches backend's _to_mgdl).
const GLUCOSE_MGDL_PER_MMOL = 18.0182;
// 1 mmol/L cholesterol ~= 38.67 mg/dL — the correct clinical conversion
// (distinct from glucose's factor, unlike the backend's chat-filter
// shortcut which reuses the glucose factor for both).
const CHOLESTEROL_MGDL_PER_MMOL = 38.67;

export function glucoseToMgdl(value: number, unit: Unit): number {
  return unit === "mmol/L" ? value * GLUCOSE_MGDL_PER_MMOL : value;
}

export function glucoseFromMgdl(mgdl: number, unit: Unit): number {
  return unit === "mmol/L" ? mgdl / GLUCOSE_MGDL_PER_MMOL : mgdl;
}

export function cholesterolToMgdl(value: number, unit: Unit): number {
  return unit === "mmol/L" ? value * CHOLESTEROL_MGDL_PER_MMOL : value;
}

export function cholesterolFromMgdl(mgdl: number, unit: Unit): number {
  return unit === "mmol/L" ? mgdl / CHOLESTEROL_MGDL_PER_MMOL : mgdl;
}

export function bloodSugarStatus(value: number, unit: Unit, context: SugarContext): VitalsStatus {
  const mgdl = glucoseToMgdl(value, unit);
  if (mgdl < 54) return { tone: "alert", label: "Very low" };
  if (mgdl < 70) return { tone: "alert", label: "Low" };

  if (context === "post_meal") {
    if (mgdl < 140) return { tone: "good", label: "Normal" };
    if (mgdl < 200) return { tone: "caution", label: "Pre-diabetic" };
    return { tone: "alert", label: "Diabetic range" };
  }

  // Fasting and random/unspecified both use the fasting cutoffs — the more
  // conservative of the two, and what the chat filter already assumes when
  // no context was recorded.
  if (mgdl < 100) return { tone: "good", label: "Normal" };
  if (mgdl < 126) return { tone: "caution", label: "Pre-diabetic" };
  return { tone: "alert", label: "Diabetic range" };
}

export function bloodPressureStatus(systolic: number, diastolic: number): VitalsStatus {
  if (systolic > 180 || diastolic > 120) return { tone: "alert", label: "Hypertensive crisis" };
  if (systolic >= 140 || diastolic >= 90) return { tone: "alert", label: "Stage 2" };
  if (systolic >= 130 || diastolic >= 80) return { tone: "caution", label: "Stage 1" };

  // Checked before "Elevated" so a low diastolic never gets masked by a
  // borderline-high systolic reading (e.g. 120/50 is a low reading, not
  // "Elevated") — the two aren't mutually exclusive severity tiers above.
  const isLow = systolic < 90 || diastolic < 60;
  if (systolic >= 120 && !isLow) return { tone: "caution", label: "Elevated" };
  if (isLow) return { tone: "caution", label: "Low" };
  return { tone: "good", label: "Normal" };
}

export function cholesterolStatus(total: number, unit: Unit): VitalsStatus {
  const mgdl = cholesterolToMgdl(total, unit);
  if (mgdl < 120) return { tone: "caution", label: "Low" };
  if (mgdl < 200) return { tone: "good", label: "Desirable" };
  if (mgdl < 240) return { tone: "caution", label: "Borderline high" };
  return { tone: "alert", label: "High" };
}

export const VITALS_TONE_TEXT: Record<VitalsTone, string> = {
  good: "text-success",
  caution: "text-warning",
  alert: "text-danger",
};

export const VITALS_TONE_BG: Record<VitalsTone, string> = {
  good: "bg-success",
  caution: "bg-warning",
  alert: "bg-danger",
};

export const VITALS_TONE_MUTED_BG: Record<VitalsTone, string> = {
  good: "bg-success-muted",
  caution: "bg-warning-muted",
  alert: "bg-danger-muted",
};
