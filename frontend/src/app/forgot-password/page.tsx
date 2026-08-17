"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthCard } from "@/components/AuthCard";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/validation/auth";

type ResetResponse = {
  message: string;
  reset_token?: string | null;
  reset_url?: string | null;
};

export default function ForgotPasswordPage() {
  const [result, setResult] = useState<ResetResponse | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    const res = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const data = (await res.json().catch(() => null)) as ResetResponse | null;
    setResult(data ?? { message: "Something went wrong. Please try again." });
  }

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <AuthCard
        title="Reset your password"
        footer={
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to login
          </Link>
        }
      >
        {!result ? (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <p className="text-sm text-muted-foreground">
              Enter the email on your account and we&apos;ll generate a reset link.
            </p>
            <TextField label="Email" type="email" required error={errors.email?.message} {...register("email")} />
            <Button type="submit" loading={isSubmitting} className="w-full">
              {isSubmitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-foreground">{result.message}</p>
            {result.reset_url && (
              <Alert variant="warning">
                <p className="mb-1 text-xs font-medium tracking-wide uppercase">
                  Dev mode — no email service configured yet
                </p>
                <Link href={result.reset_url} className="break-all underline">
                  {result.reset_url}
                </Link>
              </Alert>
            )}
          </div>
        )}
      </AuthCard>
    </main>
  );
}
