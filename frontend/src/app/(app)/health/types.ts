export type HealthRecordCategory =
  | "blood_sugar"
  | "blood_pressure"
  | "cholesterol"
  | "condition"
  | "other";

export type HealthRecord = {
  id: string;
  category: HealthRecordCategory;
  value: Record<string, unknown>;
  recorded_at: string;
  visible_to_family: boolean;
  created_at: string;
};
