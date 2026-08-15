export type PersonNode = {
  person_id: string;
  first_name: string;
  last_name: string;
  sex: "male" | "female" | null;
  is_claimed: boolean;
  is_self: boolean;
  profile_picture_url: string | null;
  relationship: string;
  category: "blood" | "spouse" | "in_law" | "self" | "unknown";
  parent_ids: string[];
  child_ids: string[];
  spouse_ids: string[];
};

export type FamilyGraphResponse = {
  ego_person_id: string;
  persons: PersonNode[];
};
