/** Shared display formatting for health report values — used by the
 * editable report view and the read-only family-member report modal alike,
 * so the two never drift in how they present the same value shapes. */

export function asString(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

export function genderLabel(sex: "male" | "female" | null): string {
  if (sex === "male") return "Male";
  if (sex === "female") return "Female";
  return "Not specified";
}

export function formatBloodSugar(value: Record<string, unknown>): string {
  if (value.value === undefined) return "Not recorded yet";
  const context =
    typeof value.context === "string" && value.context ? ` (${value.context.replace("_", " ")})` : "";
  return `${asString(value.value)} ${asString(value.unit) || "mg/dL"}${context}`;
}

export function formatBloodPressure(value: Record<string, unknown>): string {
  if (value.systolic === undefined || value.diastolic === undefined) return "Not recorded yet";
  return `${asString(value.systolic)}/${asString(value.diastolic)} mmHg`;
}

export function formatCholesterol(value: Record<string, unknown>): string {
  if (value.total === undefined) return "Not recorded yet";
  const unit = asString(value.unit) || "mg/dL";
  const parts = [`Total ${asString(value.total)} ${unit}`];
  if (value.hdl !== undefined) parts.push(`HDL ${asString(value.hdl)}`);
  if (value.ldl !== undefined) parts.push(`LDL ${asString(value.ldl)}`);
  if (value.triglycerides !== undefined) parts.push(`Trig ${asString(value.triglycerides)}`);
  return parts.join(" · ");
}
