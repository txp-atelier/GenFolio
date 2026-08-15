"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthCard } from "@/components/AuthCard";
import { PasswordInput } from "@/components/PasswordInput";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/validation/auth";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { new_password: "", confirm_password: "" },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    setServerError(null);

    const res = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: values.new_password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setServerError(typeof data.detail === "string" ? data.detail : "Reset failed");
      return;
    }

    router.push("/login");
  }

  if (!token) {
    return (
      <AuthCard title="Choose a new password">
        <Alert variant="error">
          This reset link is missing its token. Request a new one from the{" "}
          <Link href="/forgot-password" className="underline">
            forgot password
          </Link>{" "}
          page.
        </Alert>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <PasswordInput
          label="New password"
          required
          hint="At least 8 characters"
          error={errors.new_password?.message}
          {...register("new_password")}
        />
        <PasswordInput
          label="Confirm new password"
          required
          error={errors.confirm_password?.message}
          {...register("confirm_password")}
        />

        {serverError && <Alert variant="error">{serverError}</Alert>}

        <Button type="submit" loading={isSubmitting} className="w-full">
          Save new password
        </Button>
      </form>
    </AuthCard>
  );
}
