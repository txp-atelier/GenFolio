import { z } from "zod";

const optionalNumberString = (max: number, unitLabel: string) =>
  z.string().refine(
    (val) => val === "" || (!Number.isNaN(Number(val)) && Number(val) > 0 && Number(val) <= max),
    { message: `Enter a value between 0 and ${max} ${unitLabel}` }
  );

export const profileSchema = z.object({
  dob: z
    .string()
    .refine((val) => val === "" || !Number.isNaN(Date.parse(val)), { message: "Enter a valid date" })
    .refine((val) => val === "" || new Date(val) <= new Date(), {
      message: "Date of birth can't be in the future",
    }),
  sex: z.enum(["", "male", "female"]),
  height_cm: optionalNumberString(300, "cm"),
  weight_kg: optionalNumberString(500, "kg"),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
