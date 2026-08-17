export type MeResponse = {
  user: { id: string; email: string };
  person_id: string;
  family_id: string;
  family_name: string;
  first_name: string;
  last_name: string;
  dob: string | null;
  sex: "male" | "female" | null;
  height_cm: number | null;
  weight_kg: number | null;
  profile_picture_url: string | null;
};

export type HealthReportRecord = {
  value: Record<string, unknown>;
  recorded_at: string;
  visible_to_family: boolean;
};

/** A read-only snapshot of one family member's health report — the shape
 * returned by GET /health-records/family/{person_id}, filtered server-side
 * to only what they've marked visible_to_family. Shared across every place
 * a person's card can be clicked to view it: compare results, the tree, and
 * search. */
export type FamilyMemberReport = {
  person_id: string;
  first_name: string;
  last_name: string;
  sex: "male" | "female" | null;
  age: number | null;
  profile_picture_url: string | null;
  blood_sugar: HealthReportRecord | null;
  blood_pressure: HealthReportRecord | null;
  cholesterol: HealthReportRecord | null;
  other: HealthReportRecord | null;
};
