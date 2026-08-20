"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Controller, useForm } from "react-hook-form";

import { Avatar } from "@/components/Avatar";
import { ShieldIcon } from "@/components/icons";
import { Dropdown, type DropdownOption } from "@/components/Dropdown";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DateField } from "@/components/ui/DateField";
import { TextareaField } from "@/components/ui/TextareaField";
import { TextField } from "@/components/ui/TextField";
import { formatDateDMY } from "@/lib/formatDate";
import { asString, genderLabel } from "@/lib/healthFormat";
import { useUser } from "@/lib/UserContext";
import { OTHER_RECORD_NAME } from "@/lib/validation/healthReport";
import { profileSchema, type ProfileFormValues } from "@/lib/validation/profile";
import type { MeResponse } from "@/lib/types";

import { deleteHealthRecord, fetchHealthRecords, HEALTH_RECORDS_QUERY_KEY, latestByCategory, upsertHealthCategory } from "./api";
import type { HealthRecord } from "./types";

const SEX_OPTIONS: DropdownOption[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

function hasProfileDetails(me: MeResponse): boolean {
  return Boolean(me.dob && me.sex && me.height_cm != null && me.weight_kg != null);
}

/** Profile fields + the "other health notes" record, folded into the health
 * report's "My details" tab (previously the standalone /profile page — see
 * app/(app)/profile/page.tsx, now just a redirect here). Mirrors the
 * Vitals tab's own read-only-view / edit-form toggle (see ReportView /
 * ReportForm in HealthReport.tsx) rather than always showing the form. */
export function MyDetailsSection() {
  const initial = useUser();
  const [me, setMe] = useState<MeResponse>(initial);
  const [isEditing, setIsEditing] = useState(!hasProfileDetails(initial));

  const { data: records } = useQuery({ queryKey: HEALTH_RECORDS_QUERY_KEY, queryFn: fetchHealthRecords });
  const otherRecord = records ? latestByCategory(records).other : undefined;
  const otherNotes = asString(otherRecord?.value?.notes);

  return (
    <div className="flex flex-col gap-6">
      {isEditing ? (
        <MyDetailsForm
          me={me}
          otherRecord={otherRecord}
          otherNotes={otherNotes}
          onDone={(nextMe) => {
            setMe(nextMe);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <MyDetailsView me={me} otherNotes={otherNotes} onEdit={() => setIsEditing(true)} />
      )}

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
          <li>Health details are shared with your family by default — turn off sharing on your health report any time.</li>
          <li>Invite links only work once, and stop working after 7 days if no one uses them.</li>
        </ul>
      </Card>
    </div>
  );
}

type DetailRowProps = { label: string; value: string };

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

type MyDetailsViewProps = { me: MeResponse; otherNotes: string; onEdit: () => void };

/** The read-only summary — same "view first, Edit to change it" shape as
 * the Vitals tab's ReportView. */
function MyDetailsView({ me, otherNotes, onEdit }: MyDetailsViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">My details</h3>
        <Button type="button" variant="secondary" onClick={onEdit} className="px-3 py-1.5 text-xs">
          Edit details
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Avatar url={me.profile_picture_url} firstName={me.first_name} lastName={me.last_name} size={64} />
        <p className="text-sm font-semibold text-foreground">
          {me.first_name} {me.last_name}
        </p>
      </div>

      <dl className="flex flex-col divide-y divide-border">
        <DetailRow label="Date of birth" value={me.dob ? formatDateDMY(me.dob) : "Not set"} />
        <DetailRow label="Gender" value={genderLabel(me.sex)} />
        <DetailRow label="Height" value={me.height_cm != null ? `${me.height_cm} cm` : "Not set"} />
        <DetailRow label="Weight" value={me.weight_kg != null ? `${me.weight_kg} kg` : "Not set"} />
      </dl>

      <div>
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Others</h3>
        <p className="mt-2 text-sm text-foreground">{otherNotes || "No notes recorded."}</p>
      </div>
    </div>
  );
}

type MyDetailsFormProps = {
  me: MeResponse;
  otherRecord: HealthRecord | undefined;
  otherNotes: string;
  onDone: (nextMe: MeResponse) => void;
  onCancel: () => void;
};

function MyDetailsForm({ me, otherRecord, otherNotes, onDone, onCancel }: MyDetailsFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: me.first_name,
      last_name: me.last_name,
      dob: me.dob ?? "",
      sex: me.sex ?? "",
      height_cm: me.height_cm != null ? String(me.height_cm) : "",
      weight_kg: me.weight_kg != null ? String(me.weight_kg) : "",
      other_notes: otherNotes,
    },
  });

  // The "other" record loads asynchronously (separate query from `me`), so
  // if it arrives after this form has already mounted, push its value in
  // rather than leaving the field blank.
  useEffect(() => {
    reset((prev) => ({ ...prev, other_notes: otherNotes }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherNotes]);

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
  }

  // Pressing Enter in a plain <input> natively submits its enclosing form —
  // that would save on every field the moment someone finishes typing a
  // value (e.g. the date-of-birth box) instead of only on an explicit Save
  // click. <textarea> (the "Others" notes field) is left alone since Enter
  // there is expected to add a line break, not submit.
  function handleFormKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
      e.preventDefault();
    }
  }

  const mutation = useMutation({
    mutationFn: async (values: ProfileFormValues): Promise<MeResponse> => {
      let nextMe = me;

      if (pendingFile) {
        const formData = new FormData();
        formData.append("file", pendingFile);
        const res = await fetch("/api/persons/me/profile-picture", { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof data.detail === "string"
              ? data.detail
              : "We couldn't upload that photo — please try a different file."
          );
        }
        nextMe = data;
      }

      const res = await fetch("/api/persons/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: values.first_name.trim(),
          last_name: values.last_name.trim(),
          dob: values.dob,
          sex: values.sex,
          height_cm: Number(values.height_cm),
          weight_kg: Number(values.weight_kg),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "We couldn't save your changes — please try again."
        );
      }
      nextMe = { ...nextMe, ...data };

      const notes = values.other_notes.trim();
      if (notes) {
        await upsertHealthCategory(
          otherRecord,
          "other",
          { name: OTHER_RECORD_NAME, notes },
          otherRecord?.visible_to_family ?? true
        );
      } else if (otherRecord) {
        await deleteHealthRecord(otherRecord.id);
      }

      return nextMe;
    },
    onSuccess: (nextMe) => {
      queryClient.invalidateQueries({ queryKey: HEALTH_RECORDS_QUERY_KEY });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPendingFile(null);
      setPreviewUrl(null);
      router.refresh();
      onDone(nextMe);
    },
  });

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} onKeyDown={handleFormKeyDown} noValidate>
      <div className="flex flex-col gap-6">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">My details</h3>

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

        <div className="grid grid-cols-2 gap-4">
          <TextField label="First name" required error={errors.first_name?.message} {...register("first_name")} />
          <TextField label="Last name" required error={errors.last_name?.message} {...register("last_name")} />
        </div>

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

        <TextareaField
          label="Others"
          hint="Optional — any other condition or note you'd like on record"
          rows={4}
          error={errors.other_notes?.message}
          {...register("other_notes")}
        />

        {mutation.isError && <Alert variant="error">{(mutation.error as Error | null)?.message}</Alert>}
        {!mutation.isError && Object.keys(errors).length > 0 && (
          <Alert variant="error">We couldn&apos;t save this — please check the highlighted fields and try again.</Alert>
        )}

        <div className="flex gap-2">
          <Button type="submit" loading={mutation.isPending} className="self-start">
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={mutation.isPending}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
