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
