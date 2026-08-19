import { z } from "zod";

function isPositiveNumber(val: string): boolean {
  return val.trim() !== "" && !Number.isNaN(Number(val)) && Number(val) > 0;
}

function isPositiveInt(val: string): boolean {
  return val.trim() !== "" && Number.isInteger(Number(val)) && Number(val) > 0;
}

export const healthReportSchema = z
  .object({
    sugar_value: z.string(),
    sugar_unit: z.enum(["mg/dL", "mmol/L"]),
    sugar_context: z.enum(["", "fasting", "post_meal", "random"]),

    systolic: z.string(),
    diastolic: z.string(),

    cholesterol_total: z.string(),
    cholesterol_unit: z.enum(["mg/dL", "mmol/L"]),

    other_notes: z.string(),
    share_with_family: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (!isPositiveNumber(data.sugar_value)) issue("sugar_value", "Enter a positive number");
    if (!isPositiveInt(data.systolic)) issue("systolic", "Enter a positive whole number");
    if (!isPositiveInt(data.diastolic)) issue("diastolic", "Enter a positive whole number");
    if (!isPositiveNumber(data.cholesterol_total)) {
      issue("cholesterol_total", "Enter a positive number");
    }

    if (data.other_notes.length > 2000) {
      issue("other_notes", "Must be 2000 characters or fewer");
    }
  });

export type HealthReportFormValues = z.infer<typeof healthReportSchema>;

// Fixed name for the single "other" record the report manages — the
// backend's `other` category shape requires a name, but the report only
// exposes one freeform textarea, not a name field of its own.
export const OTHER_RECORD_NAME = "Other / special disorders";

export type ReportPayloads = {
  blood_sugar: Record<string, unknown>;
  blood_pressure: Record<string, unknown>;
  cholesterol: Record<string, unknown>;
  other: Record<string, unknown> | null;
  visible_to_family: boolean;
};

export function buildReportPayloads(data: HealthReportFormValues): ReportPayloads {
  return {
    visible_to_family: data.share_with_family,
    blood_sugar: {
      value: Number(data.sugar_value),
      unit: data.sugar_unit,
      ...(data.sugar_context ? { context: data.sugar_context } : {}),
    },
    blood_pressure: {
      systolic: Number(data.systolic),
      diastolic: Number(data.diastolic),
    },
    cholesterol: {
      total: Number(data.cholesterol_total),
      unit: data.cholesterol_unit,
    },
    other: data.other_notes.trim()
      ? { name: OTHER_RECORD_NAME, notes: data.other_notes.trim() }
      : null,
  };
}
