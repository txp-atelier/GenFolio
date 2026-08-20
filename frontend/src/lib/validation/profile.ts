import { z } from "zod";

function isValueInRange(val: string, max: number): boolean {
  return val.trim() !== "" && !Number.isNaN(Number(val)) && Number(val) > 0 && Number(val) <= max;
}

export const profileSchema = z
  .object({
    first_name: z.string(),
    last_name: z.string(),
    dob: z.string(),
    sex: z.enum(["", "male", "female"]),
    height_cm: z.string(),
    weight_kg: z.string(),
    other_notes: z.string(),
  })
  .superRefine((data, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

    if (!data.first_name.trim()) issue("first_name", "First name is required");
    if (!data.last_name.trim()) issue("last_name", "Last name is required");

    if (!data.dob) {
      issue("dob", "Date of birth is required");
    } else if (Number.isNaN(Date.parse(data.dob))) {
      issue("dob", "Enter a valid date");
    } else if (new Date(data.dob) > new Date()) {
      issue("dob", "Date of birth can't be in the future");
    }

    if (!data.sex) issue("sex", "Select a gender");

    if (!isValueInRange(data.height_cm, 300)) {
      issue("height_cm", data.height_cm.trim() === "" ? "This field is required" : "Enter a value between 0 and 300 cm");
    }
    if (!isValueInRange(data.weight_kg, 500)) {
      issue("weight_kg", data.weight_kg.trim() === "" ? "This field is required" : "Enter a value between 0 and 500 kg");
    }

    if (data.other_notes.length > 2000) {
      issue("other_notes", "Must be 2000 characters or fewer");
    }
  });

export type ProfileFormValues = z.infer<typeof profileSchema>;
