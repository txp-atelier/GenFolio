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

export type HealthMatch = {
  person_id: string;
  first_name: string;
  last_name: string;
  sex: "male" | "female" | null;
  age: number | null;
  profile_picture_url: string | null;
  match_percentage: number;
};

export type HealthReportFile = {
  id: string;
  title: string;
  original_filename: string;
  file_url: string;
  mime_type: string;
  uploaded_at: string;
};
