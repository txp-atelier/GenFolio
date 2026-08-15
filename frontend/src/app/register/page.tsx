"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { AuthCard } from "@/components/AuthCard";
import { PasswordInput } from "@/components/PasswordInput";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { registerSchema, type RegisterFormValues } from "@/lib/validation/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { family_name: "", first_name: "", last_name: "", email: "", password: "" },
  });

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setServerError(typeof data.detail === "string" ? data.detail : "Registration failed");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <AuthCard
        title="Create your family"
        subtitle="This starts a brand new family tree with you as the first member. Already have an invite link? Use that instead."
        footer={
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Log in
            </Link>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <TextField label="Family name" required error={errors.family_name?.message} {...register("family_name")} />

          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <TextField label="First name" required error={errors.first_name?.message} {...register("first_name")} />
            </div>
            <div className="min-w-0 flex-1">
              <TextField label="Last name" required error={errors.last_name?.message} {...register("last_name")} />
            </div>
          </div>

          <TextField label="Email" type="email" required error={errors.email?.message} {...register("email")} />

          <PasswordInput
            label="Password"
            required
            hint="At least 8 characters"
            error={errors.password?.message}
            {...register("password")}
          />

          {serverError && <Alert variant="error">{serverError}</Alert>}

          <Button type="submit" loading={isSubmitting} className="w-full">
            Create family
          </Button>
        </form>
      </AuthCard>
    </main>
  );
}
