"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { PasswordInput } from "@/components/PasswordInput";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { joinSchema, type JoinFormValues } from "@/lib/validation/auth";

export function JoinForm({ token }: { token: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<JoinFormValues>({
    resolver: zodResolver(joinSchema),
    defaultValues: { first_name: "", last_name: "", email: "", password: "" },
  });

  async function onSubmit(values: JoinFormValues) {
    setServerError(null);

    const res = await fetch(`/api/invitations/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setServerError(
        typeof data.detail === "string"
          ? data.detail
          : "We couldn't add you to the family — please check your details and try again."
      );
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
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
        {isSubmitting ? "Joining the family…" : "Join family"}
      </Button>
    </form>
  );
}
