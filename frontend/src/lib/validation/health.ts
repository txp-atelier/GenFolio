import { z } from "zod";

export const HEALTH_RECORD_CATEGORIES = [
  "blood_sugar",
  "blood_pressure",
  "cholesterol",
  "condition",
  "other",
] as const;
export type HealthRecordCategory = (typeof HEALTH_RECORD_CATEGORIES)[number];

function isPositiveNumber(val: string): boolean {
  return val.trim() !== "" && !Number.isNaN(Number(val)) && Number(val) > 0;
}

function isPositiveInt(val: string): boolean {
  return val.trim() !== "" && Number.isInteger(Number(val)) && Number(val) > 0;
}

export const healthRecordFormSchema = z
  .object({
    category: z.enum(HEALTH_RECORD_CATEGORIES),
    recorded_at: z.string().min(1, "Date is required"),
    visible_to_family: z.boolean(),

    sugar_value: z.string(),
    sugar_unit: z.enum(["mg/dL", "mmol/L"]),
    sugar_context: z.enum(["", "fasting", "post_meal", "random"]),

    systolic: z.string(),
    diastolic: z.string(),

    total: z.string(),
    hdl: z.string(),
    ldl: z.string(),
    triglycerides: z.string(),
    cholesterol_unit: z.enum(["mg/dL", "mmol/L"]),

    name: z.string(),
    diagnosed_date: z.string(),
    notes: z.string(),
  })
  .superRefine((data, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    switch (data.category) {
      case "blood_sugar":
        if (!isPositiveNumber(data.sugar_value)) {
          issue("sugar_value", "Enter a positive number");
        }
        break;
      case "blood_pressure":
        if (!isPositiveInt(data.systolic)) issue("systolic", "Enter a positive whole number");
        if (!isPositiveInt(data.diastolic)) issue("diastolic", "Enter a positive whole number");
        break;
      case "cholesterol":
        for (const [field, val] of [
          ["total", data.total],
          ["hdl", data.hdl],
          ["ldl", data.ldl],
          ["triglycerides", data.triglycerides],
        ] as const) {
          if (val.trim() !== "" && !isPositiveNumber(val)) issue(field, "Enter a positive number");
        }
        break;
      case "condition":
      case "other":
        if (data.name.trim().length === 0) issue("name", "Name is required");
        else if (data.name.length > 200) issue("name", "Name must be 200 characters or fewer");
        if (data.notes.length > 2000) issue("notes", "Notes must be 2000 characters or fewer");
        break;
    }
  });

export type HealthRecordFormValues = z.infer<typeof healthRecordFormSchema>;

export function buildHealthRecordValue(data: HealthRecordFormValues): Record<string, unknown> {
  switch (data.category) {
    case "blood_sugar":
      return {
        value: Number(data.sugar_value),
        unit: data.sugar_unit,
        ...(data.sugar_context ? { context: data.sugar_context } : {}),
      };
    case "blood_pressure":
      return { systolic: Number(data.systolic), diastolic: Number(data.diastolic) };
    case "cholesterol":
      return {
        ...(data.total.trim() ? { total: Number(data.total) } : {}),
        ...(data.hdl.trim() ? { hdl: Number(data.hdl) } : {}),
        ...(data.ldl.trim() ? { ldl: Number(data.ldl) } : {}),
        ...(data.triglycerides.trim() ? { triglycerides: Number(data.triglycerides) } : {}),
        unit: data.cholesterol_unit,
      };
    case "condition":
      return {
        name: data.name.trim(),
        ...(data.diagnosed_date ? { diagnosed_date: data.diagnosed_date } : {}),
        ...(data.notes.trim() ? { notes: data.notes.trim() } : {}),
      };
    case "other":
      return { name: data.name.trim(), ...(data.notes.trim() ? { notes: data.notes.trim() } : {}) };
  }
}
