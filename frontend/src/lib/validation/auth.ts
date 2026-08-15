import { z } from "zod";

export const emailField = z.string().min(1, "Email is required").email("Enter a valid email address");

export const nameField = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(100, `${label} must be 100 characters or fewer`);

export const newPasswordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or fewer");

export const registerSchema = z.object({
  family_name: z.string().trim().min(1, "Family name is required").max(200, "Family name must be 200 characters or fewer"),
  first_name: nameField("First name"),
  last_name: nameField("Last name"),
  email: emailField,
  password: newPasswordField,
});
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required"),
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailField,
});
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    new_password: newPasswordField,
    confirm_password: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const joinSchema = z.object({
  first_name: nameField("First name"),
  last_name: nameField("Last name"),
  email: emailField,
  password: newPasswordField,
});
export type JoinFormValues = z.infer<typeof joinSchema>;
