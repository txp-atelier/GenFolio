"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Avatar } from "@/components/Avatar";
import { Dropdown, type DropdownOption } from "@/components/Dropdown";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { TextareaField } from "@/components/ui/TextareaField";
import { TextField } from "@/components/ui/TextField";
import { calculateAge } from "@/lib/age";
import { summarizeApiError } from "@/lib/apiError";
import { formatDateDMY } from "@/lib/formatDate";
import {
  asString,
  formatBloodPressure,
  formatBloodSugar,
  formatCholesterol,
  genderLabel,
} from "@/lib/healthFormat";
import { useUser } from "@/lib/UserContext";
import {
  buildReportPayloads,
  healthReportSchema,
  type HealthReportFormValues,
  type ReportPayloads,
} from "@/lib/validation/healthReport";

import type { HealthRecord, HealthRecordCategory } from "./types";

export const HEALTH_RECORDS_QUERY_KEY = ["health-records"];

const SUGAR_UNIT_OPTIONS: DropdownOption[] = [
  { value: "mg/dL", label: "mg/dL" },
  { value: "mmol/L", label: "mmol/L" },
];

const SUGAR_CONTEXT_OPTIONS: DropdownOption[] = [
  { value: "", label: "Not specified" },
  { value: "fasting", label: "Fasting" },
  { value: "post_meal", label: "After a meal" },
  { value: "random", label: "Random" },
];

async function fetchRecords(): Promise<HealthRecord[]> {
  const res = await fetch("/api/health-records");
  if (!res.ok) throw new Error("We couldn't load your health records — please refresh the page.");
  return res.json();
}

function latestByCategory(
  records: HealthRecord[]
): Partial<Record<HealthRecordCategory, HealthRecord>> {
  const latest: Partial<Record<HealthRecordCategory, HealthRecord>> = {};
  for (const record of records) {
    const current = latest[record.category];
    if (!current || record.recorded_at > current.recorded_at) {
      latest[record.category] = record;
    }
  }
  return latest;
}

async function upsertCategory(
  existing: HealthRecord | undefined,
  category: string,
  value: Record<string, unknown>,
  visibleToFamily: boolean
) {
  const res = existing
    ? await fetch(`/api/health-records/${existing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, recorded_at: new Date().toISOString(), visible_to_family: visibleToFamily }),
      })
    : await fetch("/api/health-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          value,
          recorded_at: new Date().toISOString(),
          visible_to_family: visibleToFamily,
        }),
      });
  if (!res.ok) throw new Error(summarizeApiError(await res.json().catch(() => ({}))));
}

async function saveReport(
  latest: Partial<Record<HealthRecordCategory, HealthRecord>>,
  payloads: ReportPayloads
) {
  const share = payloads.visible_to_family;
  await upsertCategory(latest.blood_sugar, "blood_sugar", payloads.blood_sugar, share);
  await upsertCategory(latest.blood_pressure, "blood_pressure", payloads.blood_pressure, share);
  await upsertCategory(latest.cholesterol, "cholesterol", payloads.cholesterol, share);

  if (payloads.other) {
    await upsertCategory(latest.other, "other", payloads.other, share);
  } else if (latest.other) {
    const res = await fetch(`/api/health-records/${latest.other.id}`, { method: "DELETE" });
    if (!res.ok && res.status !== 204) {
      throw new Error("We couldn't clear that note — please try again.");
    }
  }
}

function hasAnyRecord(latest: Partial<Record<HealthRecordCategory, HealthRecord>>): boolean {
  return Boolean(latest.blood_sugar || latest.blood_pressure || latest.cholesterol || latest.other);
}

export function HealthReport() {
  const {
    data: records,
    isLoading,
    error: loadError,
  } = useQuery({ queryKey: HEALTH_RECORDS_QUERY_KEY, queryFn: fetchRecords });

  return (
    <Card className="flex flex-col gap-6">
      <ReportHeader />
      {isLoading && <p className="text-sm text-muted-foreground">Loading your health report…</p>}
      {loadError && (
        <Alert variant="error">We couldn&apos;t load your health report — please refresh the page.</Alert>
      )}
      {records && <ReportBody latest={latestByCategory(records)} />}
    </Card>
  );
}

function ReportHeader() {
  const me = useUser();
  const age = calculateAge(me.dob);
  return (
    <div className="flex items-center gap-4 border-b border-border pb-6">
      <Avatar url={me.profile_picture_url} firstName={me.first_name} lastName={me.last_name} size={72} />
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {me.first_name} {me.last_name}
        </h2>
        <p className="text-sm text-muted-foreground">
          {genderLabel(me.sex)}
          {age !== null ? ` · ${age} years old` : ""}
        </p>
        <p className="text-xs text-muted-foreground">{me.family_name} family</p>
      </div>
    </div>
  );
}

type LatestRecords = Partial<Record<HealthRecordCategory, HealthRecord>>;

function ReportBody({ latest }: { latest: LatestRecords }) {
  const [isEditing, setIsEditing] = useState(!hasAnyRecord(latest));

  if (isEditing) {
    return (
      <ReportForm latest={latest} onDone={() => setIsEditing(false)} onCancel={() => setIsEditing(false)} />
    );
  }
  return <ReportView latest={latest} onEdit={() => setIsEditing(true)} />;
}

type ReportRowProps = { label: string; value: string; recordedAt?: string };

function ReportRow({ label, value, recordedAt }: ReportRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="text-right">
        <p className="text-sm text-foreground">{value}</p>
        {recordedAt && (
          <p className="text-xs text-muted-foreground">Last recorded: {formatDateDMY(recordedAt)}</p>
        )}
      </div>
    </div>
  );
}

type ReportViewProps = { latest: LatestRecords; onEdit: () => void };

/** The report presented the way a doctor would hand it back — plain values,
 * no inputs — with a single Edit affordance to switch into the form. */
function ReportView({ latest, onEdit }: ReportViewProps) {
  const filled = hasAnyRecord(latest);
  const notes = asString(latest.other?.value?.notes);
  const shared =
    latest.blood_sugar?.visible_to_family ??
    latest.blood_pressure?.visible_to_family ??
    latest.cholesterol?.visible_to_family ??
    latest.other?.visible_to_family ??
    true;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {filled ? "Vitals" : "Health report"}
        </h3>
        <Button type="button" variant="secondary" onClick={onEdit} className="px-3 py-1.5 text-xs">
          {filled ? "Edit report" : "Add health report"}
        </Button>
      </div>

      {!filled ? (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t added your health details yet. Click &quot;Add health report&quot; to get started.
        </p>
      ) : (
        <>
          <dl className="flex flex-col divide-y divide-border">
            <ReportRow
              label="Blood sugar"
              value={formatBloodSugar(latest.blood_sugar?.value ?? {})}
              recordedAt={latest.blood_sugar?.recorded_at}
            />
            <ReportRow
              label="Blood pressure"
              value={formatBloodPressure(latest.blood_pressure?.value ?? {})}
              recordedAt={latest.blood_pressure?.recorded_at}
            />
            <ReportRow
              label="Cholesterol"
              value={formatCholesterol(latest.cholesterol?.value ?? {})}
              recordedAt={latest.cholesterol?.recorded_at}
            />
          </dl>

          <div>
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Other health notes
            </h3>
            <p className="mt-2 text-sm text-foreground">{notes || "No notes recorded."}</p>
          </div>

          <p className="text-xs text-muted-foreground">
            {shared
              ? "Shared with your family for comparison."
              : "Kept private — not shared with family."}
          </p>
        </>
      )}
    </div>
  );
}

type ReportFormProps = { latest: LatestRecords; onDone: () => void; onCancel: () => void };

function ReportForm({ latest, onDone, onCancel }: ReportFormProps) {
  const queryClient = useQueryClient();
  const [pendingValues, setPendingValues] = useState<HealthReportFormValues | null>(null);

  const sugar = latest.blood_sugar?.value ?? {};
  const bp = latest.blood_pressure?.value ?? {};
  const cholesterol = latest.cholesterol?.value ?? {};
  const other = latest.other?.value ?? {};
  const anyExistingRecord = latest.blood_sugar ?? latest.blood_pressure ?? latest.cholesterol ?? latest.other;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<HealthReportFormValues>({
    resolver: zodResolver(healthReportSchema),
    defaultValues: {
      sugar_value: asString(sugar.value),
      sugar_unit: (asString(sugar.unit) || "mg/dL") as "mg/dL" | "mmol/L",
      sugar_context: asString(sugar.context) as "" | "fasting" | "post_meal" | "random",

      systolic: asString(bp.systolic),
      diastolic: asString(bp.diastolic),

      cholesterol_total: asString(cholesterol.total),
      cholesterol_hdl: asString(cholesterol.hdl),
      cholesterol_ldl: asString(cholesterol.ldl),
      cholesterol_triglycerides: asString(cholesterol.triglycerides),
      cholesterol_unit: (asString(cholesterol.unit) || "mg/dL") as "mg/dL" | "mmol/L",

      other_notes: asString(other.notes),
      share_with_family: anyExistingRecord?.visible_to_family ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: (values: HealthReportFormValues) => saveReport(latest, buildReportPayloads(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HEALTH_RECORDS_QUERY_KEY });
      onDone();
    },
  });

  function onValid(values: HealthReportFormValues) {
    // Clearing a previously-saved note is a small, real "delete" — confirm
    // it in plain language instead of silently dropping it on save.
    const isClearingOtherNotes = latest.other && !values.other_notes.trim();
    if (isClearingOtherNotes) {
      setPendingValues(values);
      return;
    }
    mutation.mutate(values);
  }

  function confirmClearOtherNotes() {
    if (!pendingValues) return;
    mutation.mutate(pendingValues);
    setPendingValues(null);
  }

  return (
    <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-6" noValidate>
      <section className="flex flex-col gap-5">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Vitals</h3>

        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <TextField
                label="Blood sugar"
                type="number"
                step="0.1"
                required
                error={errors.sugar_value?.message}
                {...register("sugar_value")}
              />
            </div>
            <div className="min-w-0 flex-1">
              <Controller
                name="sugar_unit"
                control={control}
                render={({ field }) => (
                  <Dropdown
                    label="Unit"
                    required
                    options={SUGAR_UNIT_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>
          <Controller
            name="sugar_context"
            control={control}
            render={({ field }) => (
              <Dropdown
                label="Context"
                hint="Optional"
                options={SUGAR_CONTEXT_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {latest.blood_sugar && (
            <p className="text-xs text-muted-foreground">
              Last recorded: {formatDateDMY(latest.blood_sugar.recorded_at)}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <TextField
                label="Systolic"
                type="number"
                required
                error={errors.systolic?.message}
                {...register("systolic")}
              />
            </div>
            <div className="min-w-0 flex-1">
              <TextField
                label="Diastolic"
                type="number"
                required
                error={errors.diastolic?.message}
                {...register("diastolic")}
              />
            </div>
          </div>
          {latest.blood_pressure && (
            <p className="text-xs text-muted-foreground">
              Last recorded: {formatDateDMY(latest.blood_pressure.recorded_at)}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Total cholesterol"
              type="number"
              required
              error={errors.cholesterol_total?.message}
              {...register("cholesterol_total")}
            />
            <TextField
              label="HDL"
              type="number"
              hint="Optional"
              error={errors.cholesterol_hdl?.message}
              {...register("cholesterol_hdl")}
            />
            <TextField
              label="LDL"
              type="number"
              hint="Optional"
              error={errors.cholesterol_ldl?.message}
              {...register("cholesterol_ldl")}
            />
            <TextField
              label="Triglycerides"
              type="number"
              hint="Optional"
              error={errors.cholesterol_triglycerides?.message}
              {...register("cholesterol_triglycerides")}
            />
          </div>
          <Controller
            name="cholesterol_unit"
            control={control}
            render={({ field }) => (
              <Dropdown
                label="Unit"
                required
                options={SUGAR_UNIT_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {latest.cholesterol && (
            <p className="text-xs text-muted-foreground">
              Last recorded: {formatDateDMY(latest.cholesterol.recorded_at)}
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Other health notes
        </h3>
        <TextareaField
          label="Notes"
          hint="Optional — describe any other condition you'd like on record"
          rows={4}
          error={errors.other_notes?.message}
          {...register("other_notes")}
        />
      </section>

      <div className="flex items-start gap-2 rounded-2xl border border-border bg-surface-muted px-4 py-3">
        <Checkbox
          label="Share this report with my family"
          hint="Lets your blood relatives include your numbers in “Compare with family”"
          className="mt-0.5"
          {...register("share_with_family")}
        />
        <HelpTooltip label="What does sharing do?">
          When this is on, the relatives in your family tree can see this report and include it when
          they compare their own health details with yours. It&apos;s never visible to anyone outside
          your family tree, and you can turn it off any time.
        </HelpTooltip>
      </div>

      {mutation.isError && <Alert variant="error">{(mutation.error as Error | null)?.message}</Alert>}
      {!mutation.isError && Object.keys(errors).length > 0 && (
        <Alert variant="error">We couldn&apos;t save this — please check the highlighted fields and try again.</Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" loading={mutation.isPending} className="self-start">
          {mutation.isPending ? "Saving…" : "Save report"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={mutation.isPending}>
          Cancel
        </Button>
      </div>

      <ConfirmDialog
        open={pendingValues !== null}
        title="Remove this health note?"
        description="You've cleared the text in “Other health notes”. Saving now will remove it from your report. This can't be undone."
        confirmLabel="Yes, remove it"
        loading={mutation.isPending}
        onConfirm={confirmClearOtherNotes}
        onCancel={() => setPendingValues(null)}
      />
    </form>
  );
}
