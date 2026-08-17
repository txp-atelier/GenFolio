"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Controller, useForm } from "react-hook-form";

import { Avatar } from "@/components/Avatar";
import { ShieldIcon } from "@/components/icons";
import { Dropdown, type DropdownOption } from "@/components/Dropdown";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateField";
import { TextField } from "@/components/ui/TextField";
import { useUser } from "@/lib/UserContext";
import { profileSchema, type ProfileFormValues } from "@/lib/validation/profile";
import type { MeResponse } from "@/lib/types";

const SEX_OPTIONS: DropdownOption[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

export function ProfileClient() {
  const router = useRouter();
  const initial = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [me, setMe] = useState<MeResponse>(initial);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      dob: initial.dob ?? "",
      sex: initial.sex ?? "",
      height_cm: initial.height_cm != null ? String(initial.height_cm) : "",
      weight_kg: initial.weight_kg != null ? String(initial.weight_kg) : "",
    },
  });

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setSaved(false);
    setServerError(null);
  }

  async function onSubmit(values: ProfileFormValues) {
    setSaving(true);
    setServerError(null);
    setSaved(false);

    let nextMe = me;

    if (pendingFile) {
      const formData = new FormData();
      formData.append("file", pendingFile);
      const res = await fetch("/api/persons/me/profile-picture", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaving(false);
        setServerError(
          typeof data.detail === "string"
            ? data.detail
            : "We couldn't upload that photo — please try a different file."
        );
        return;
      }
      nextMe = data;
    }

    const res = await fetch("/api/persons/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dob: values.dob,
        sex: values.sex,
        height_cm: Number(values.height_cm),
        weight_kg: Number(values.weight_kg),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setServerError(
        typeof data.detail === "string"
          ? data.detail
          : "We couldn't save your changes — please try again."
      );
      return;
    }

    setMe({ ...nextMe, ...data });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setPreviewUrl(null);
    setSaved(true);
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your profile, and who can see what.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Avatar
              url={previewUrl ?? me.profile_picture_url}
              firstName={me.first_name}
              lastName={me.last_name}
              size={72}
            />
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs"
              >
                Change photo
              </Button>
              {pendingFile && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Photo will be saved with your changes.
                </p>
              )}
            </div>
          </div>

          <Controller
            name="dob"
            control={control}
            render={({ field }) => (
              <DateField
                label="Date of birth"
                required
                value={field.value}
                onChange={field.onChange}
                maxDate={new Date()}
                error={errors.dob?.message}
              />
            )}
          />

          <Controller
            name="sex"
            control={control}
            render={({ field }) => (
              <Dropdown
                label="Gender"
                required
                placeholder="Select gender"
                options={SEX_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.sex?.message}
              />
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Height (cm)"
              type="number"
              step="any"
              required
              error={errors.height_cm?.message}
              {...register("height_cm")}
            />
            <TextField
              label="Weight (kg)"
              type="number"
              step="any"
              required
              error={errors.weight_kg?.message}
              {...register("weight_kg")}
            />
          </div>

          {serverError && <Alert variant="error">{serverError}</Alert>}
          {saved && <Alert variant="success">Your profile has been updated.</Alert>}

          <Button type="submit" loading={saving} className="self-start">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </Card>
      </form>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: "var(--gen-up1)" }}
          >
            <ShieldIcon width={18} height={18} />
          </span>
          <h2 className="font-heading text-base font-semibold text-foreground">Privacy &amp; sharing</h2>
        </div>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          <li>Only people you&apos;ve added to your family tree can see your profile and photo.</li>
          <li>
            Health details you log stay private to you by default — you choose what to share when you
            save a health report.
          </li>
          <li>Invite links only work once, and stop working after 7 days if no one uses them.</li>
        </ul>
      </Card>
    </main>
  );
}
