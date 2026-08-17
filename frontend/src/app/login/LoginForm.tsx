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
import { TextField } from "@/components/ui/TextField";
import { loginSchema, type LoginFormValues } from "@/lib/validation/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setServerError(
        typeof data.detail === "string"
          ? data.detail
          : "We couldn't log you in — check your email and password and try again."
      );
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <AuthCard
      title="Log in"
      footer={
        <>
          Starting a new family?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <TextField label="Email" type="email" required error={errors.email?.message} {...register("email")} />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password<span className="ml-0.5 text-danger" aria-hidden="true">*</span>
            </label>
            <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" error={errors.password?.message} {...register("password")} />
          {errors.password?.message && (
            <p className="text-xs text-danger" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        {serverError && <Alert variant="error">{serverError}</Alert>}

        <Button type="submit" loading={isSubmitting} className="w-full">
          {isSubmitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthCard>
  );
}
