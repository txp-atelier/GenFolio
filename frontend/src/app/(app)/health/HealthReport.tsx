"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Avatar } from "@/components/Avatar";
import { Dropdown, type DropdownOption } from "@/components/Dropdown";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { TextareaField } from "@/components/ui/TextareaField";
import { UnitToggle } from "@/components/ui/UnitToggle";
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
  bloodPressureStatus,
  bloodSugarStatus,
  cholesterolFromMgdl,
  cholesterolStatus,
  cholesterolToMgdl,
  glucoseFromMgdl,
  glucoseToMgdl,
  type SugarContext,
  type Unit,
} from "@/lib/vitalsStatus";
import {
  buildReportPayloads,
  healthReportSchema,
  type HealthReportFormValues,
  type ReportPayloads,
} from "@/lib/validation/healthReport";

import type { HealthRecord, HealthRecordCategory } from "./types";
import { VitalsSlider } from "./VitalsSlider";
import { VitalsSummary } from "./VitalsSummary";

export const HEALTH_RECORDS_QUERY_KEY = ["health-records"];

const UNIT_OPTIONS = ["mg/dL", "mmol/L"] as const;

const SUGAR_CONTEXT_OPTIONS: DropdownOption[] = [
  { value: "", label: "Not specified" },
  { value: "fasting", label: "Fasting" },
  { value: "post_meal", label: "After a meal" },
  { value: "random", label: "Random" },
];

// Starting positions for a brand-new report — comfortably inside the
// normal range for each vital, so a first-time slider shows "Normal"
// rather than landing on an alarming edge value.
const DEFAULT_SUGAR_MGDL = 95;
const DEFAULT_SYSTOLIC = 116;
const DEFAULT_DIASTOLIC = 76;
const DEFAULT_CHOLESTEROL_MGDL = 180;

const SYSTOLIC_RANGE = { min: 70, max: 220, step: 1 };
const DIASTOLIC_RANGE = { min: 40, max: 140, step: 1 };

function sugarRange(unit: Unit) {
  return unit === "mmol/L" ? { min: 2.2, max: 33.3, step: 0.1 } : { min: 40, max: 600, step: 1 };
}

function cholesterolRange(unit: Unit) {
  return unit === "mmol/L" ? { min: 2.6, max: 12.9, step: 0.1 } : { min: 100, max: 500, step: 1 };
}

function roundForUnit(value: number, unit: Unit): number {
  return unit === "mmol/L" ? Math.round(value * 10) / 10 : Math.round(value);
}

function formatNumber(value: number, unit: Unit): string {
  return unit === "mmol/L" ? value.toFixed(1) : String(Math.round(value));
}

const SUGAR_HELP = (
  <>
    <p>Blood sugar (also called glucose) is the sugar in your blood. Your body uses it for energy.</p>
    <p className="mt-2">You can check it with a small home device called a glucometer, or with a blood test at a clinic.</p>
    <p className="mt-2 font-medium text-foreground">Normal range</p>
    <p>
      Before eating (fasting): under 100 mg/dL (5.6 mmol/L)
      <br />
      2 hours after eating: under 140 mg/dL (7.8 mmol/L)
    </p>
  </>
);

const BLOOD_PRESSURE_HELP = (
  <>
    <p>Blood pressure shows how hard your blood pushes against your blood vessels as your heart pumps.</p>
    <p className="mt-2">
      It&apos;s checked with a cuff around your arm — at home, a pharmacy, or a clinic. The first number
      (systolic) is the pressure when your heart beats; the second (diastolic) is the pressure when it rests.
    </p>
    <p className="mt-2 font-medium text-foreground">Normal range</p>
    <p>Below 120/80 mmHg</p>
  </>
);

const CHOLESTEROL_HELP = (
  <>
    <p>Cholesterol is a fatty substance in your blood. Too much of it can build up in your blood vessels.</p>
    <p className="mt-2">It&apos;s checked with a blood test, usually after not eating for a few hours.</p>
    <p className="mt-2 font-medium text-foreground">Normal range</p>
    <p>Desirable total: under 200 mg/dL (5.2 mmol/L)</p>
  </>
);

function numOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && v !== "" && v !== null && v !== undefined ? n : null;
}

function sugarInputFrom(record?: HealthRecord): { value: number; unit: Unit; context: SugarContext } | null {
  const value = numOrNull(record?.value.value);
  if (value === null) return null;
  return {
    value,
    unit: (asString(record?.value.unit) || "mg/dL") as Unit,
    context: (asString(record?.value.context) || "") as SugarContext,
  };
}

function bloodPressureInputFrom(record?: HealthRecord): { systolic: number; diastolic: number } | null {
  const systolic = numOrNull(record?.value.systolic);
  const diastolic = numOrNull(record?.value.diastolic);
  if (systolic === null || diastolic === null) return null;
  return { systolic, diastolic };
}

function cholesterolInputFrom(record?: HealthRecord): { total: number; unit: Unit } | null {
  const total = numOrNull(record?.value.total);
  if (total === null) return null;
  return { total, unit: (asString(record?.value.unit) || "mg/dL") as Unit };
}

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

async function deleteOtherNote(recordId: string) {
  const res = await fetch(`/api/health-records/${recordId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error("We couldn't clear that note — please try again.");
  }
}

// Runs the up-to-4 category writes in parallel rather than one after
// another — each one used to be individually slow (see backend's
// embedding_service), so awaiting them in sequence multiplied that latency
// and left a real gap where the tab could be closed mid-save with only the
// earlier categories actually written. Promise.allSettled means a failure
// in one category can't take out ones that already succeeded, and the
// caller finds out exactly which (if any) still need retrying instead of
// getting one generic error that could mean "nothing saved" or "everything
// but this one thing saved."
async function saveReport(
  latest: Partial<Record<HealthRecordCategory, HealthRecord>>,
  payloads: ReportPayloads
) {
  const share = payloads.visible_to_family;

  const tasks: { label: string; run: () => Promise<void> }[] = [
    { label: "blood sugar", run: () => upsertCategory(latest.blood_sugar, "blood_sugar", payloads.blood_sugar, share) },
    {
      label: "blood pressure",
      run: () => upsertCategory(latest.blood_pressure, "blood_pressure", payloads.blood_pressure, share),
    },
    { label: "cholesterol", run: () => upsertCategory(latest.cholesterol, "cholesterol", payloads.cholesterol, share) },
  ];

  if (payloads.other) {
    const other = payloads.other;
    tasks.push({ label: "other notes", run: () => upsertCategory(latest.other, "other", other, share) });
  } else if (latest.other) {
    tasks.push({ label: "other notes", run: () => deleteOtherNote(latest.other!.id) });
  }

  const outcomes = await Promise.allSettled(tasks.map((t) => t.run()));
  const failed = tasks.filter((_, i) => outcomes[i].status === "rejected").map((t) => t.label);

  if (failed.length === tasks.length) {
    throw new Error("We couldn't save this — please try again.");
  }
  if (failed.length > 0) {
    throw new Error(`Saved everything except ${failed.join(" and ")} — please try again to finish saving.`);
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

type ReportRowProps = { label: string; value: string; recordedAt?: string; help?: ReactNode };

function ReportRow({ label, value, recordedAt, help }: ReportRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {label}
        {help && <HelpTooltip label={`About ${label.toLowerCase()}`}>{help}</HelpTooltip>}
      </span>
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

/** The report presented the way a doctor would hand it back — a live status
 * glyph for each vital up top, plain values with no inputs below, and a
 * single Edit affordance to switch into the form. */
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
          <VitalsSummary
            sugar={sugarInputFrom(latest.blood_sugar)}
            bloodPressure={bloodPressureInputFrom(latest.blood_pressure)}
            cholesterol={cholesterolInputFrom(latest.cholesterol)}
          />

          <dl className="flex flex-col divide-y divide-border">
            <ReportRow
              label="Blood sugar"
              value={formatBloodSugar(latest.blood_sugar?.value ?? {})}
              recordedAt={latest.blood_sugar?.recorded_at}
              help={SUGAR_HELP}
            />
            <ReportRow
              label="Blood pressure"
              value={formatBloodPressure(latest.blood_pressure?.value ?? {})}
              recordedAt={latest.blood_pressure?.recorded_at}
              help={BLOOD_PRESSURE_HELP}
            />
            <ReportRow
              label="Cholesterol"
              value={formatCholesterol(latest.cholesterol?.value ?? {})}
              recordedAt={latest.cholesterol?.recorded_at}
              help={CHOLESTEROL_HELP}
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
    getValues,
    setValue,
    formState: { errors },
  } = useForm<HealthReportFormValues>({
    resolver: zodResolver(healthReportSchema),
    defaultValues: {
      sugar_value: asString(sugar.value) || String(DEFAULT_SUGAR_MGDL),
      sugar_unit: (asString(sugar.unit) || "mg/dL") as Unit,
      sugar_context: (asString(sugar.context) || "") as SugarContext,

      systolic: asString(bp.systolic) || String(DEFAULT_SYSTOLIC),
      diastolic: asString(bp.diastolic) || String(DEFAULT_DIASTOLIC),

      cholesterol_total: asString(cholesterol.total) || String(DEFAULT_CHOLESTEROL_MGDL),
      cholesterol_unit: (asString(cholesterol.unit) || "mg/dL") as Unit,

      other_notes: asString(other.notes),
      share_with_family: anyExistingRecord?.visible_to_family ?? true,
    },
  });

  const [wSugarValue, wSugarUnit, wSugarContext, wSystolic, wDiastolic, wCholTotal, wCholUnit] = useWatch({
    control,
    name: [
      "sugar_value",
      "sugar_unit",
      "sugar_context",
      "systolic",
      "diastolic",
      "cholesterol_total",
      "cholesterol_unit",
    ] as const,
  });

  const sugarUnit = wSugarUnit || "mg/dL";
  const cholUnit = wCholUnit || "mg/dL";
  const sugarContext = wSugarContext || "";
  const sugarNum = Number(wSugarValue) || 0;
  const systolicNum = Number(wSystolic) || 0;
  const diastolicNum = Number(wDiastolic) || 0;
  const cholNum = Number(wCholTotal) || 0;

  const sugarStatus = sugarNum > 0 ? bloodSugarStatus(sugarNum, sugarUnit, sugarContext) : null;
  const bpStatus = systolicNum > 0 && diastolicNum > 0 ? bloodPressureStatus(systolicNum, diastolicNum) : null;
  const cholStatus = cholNum > 0 ? cholesterolStatus(cholNum, cholUnit) : null;

  const sugarBounds = sugarRange(sugarUnit);
  const cholBounds = cholesterolRange(cholUnit);

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

  function handleSugarUnitChange(unit: Unit) {
    const current = Number(getValues("sugar_value")) || DEFAULT_SUGAR_MGDL;
    const mgdl = glucoseToMgdl(current, getValues("sugar_unit"));
    setValue("sugar_value", String(roundForUnit(glucoseFromMgdl(mgdl, unit), unit)));
    setValue("sugar_unit", unit);
  }

  function handleCholesterolUnitChange(unit: Unit) {
    const current = Number(getValues("cholesterol_total")) || DEFAULT_CHOLESTEROL_MGDL;
    const mgdl = cholesterolToMgdl(current, getValues("cholesterol_unit"));
    setValue("cholesterol_total", String(roundForUnit(cholesterolFromMgdl(mgdl, unit), unit)));
    setValue("cholesterol_unit", unit);
  }

  return (
    <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-6" noValidate>
      <section className="flex flex-col gap-5">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Vitals</h3>

        <VitalsSummary
          sugar={{ value: sugarNum, unit: sugarUnit, context: sugarContext }}
          bloodPressure={{ systolic: systolicNum, diastolic: diastolicNum }}
          cholesterol={{ total: cholNum, unit: cholUnit }}
        />

        <div className="flex flex-col gap-2">
          <VitalsSlider
            label="Blood sugar"
            value={sugarNum}
            min={sugarBounds.min}
            max={sugarBounds.max}
            step={sugarBounds.step}
            tone={sugarStatus?.tone ?? "good"}
            onChange={(v) => setValue("sugar_value", String(v))}
            unit={sugarUnit}
            formatNumber={(v) => formatNumber(v, sugarUnit)}
            statusLabel={sugarStatus?.label}
            error={errors.sugar_value?.message}
            help={SUGAR_HELP}
            trailing={
              <UnitToggle
                options={UNIT_OPTIONS}
                value={sugarUnit}
                onChange={handleSugarUnitChange}
                ariaLabel="Blood sugar unit"
              />
            }
          />
          <Controller
            name="sugar_context"
            control={control}
            render={({ field }) => (
              <Dropdown
                label="Context"
                hint="Optional — fasting or after a meal changes what counts as normal"
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

        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            Blood pressure (systolic / diastolic)
            <HelpTooltip label="About blood pressure">{BLOOD_PRESSURE_HELP}</HelpTooltip>
          </span>
          <VitalsSlider
            label="Systolic"
            value={systolicNum}
            min={SYSTOLIC_RANGE.min}
            max={SYSTOLIC_RANGE.max}
            step={SYSTOLIC_RANGE.step}
            tone={bpStatus?.tone ?? "good"}
            onChange={(v) => setValue("systolic", String(v))}
            unit="mmHg"
            formatNumber={(v) => String(Math.round(v))}
            valuePrefix="Sys: "
            error={errors.systolic?.message}
          />
          <VitalsSlider
            label="Diastolic"
            value={diastolicNum}
            min={DIASTOLIC_RANGE.min}
            max={DIASTOLIC_RANGE.max}
            step={DIASTOLIC_RANGE.step}
            tone={bpStatus?.tone ?? "good"}
            onChange={(v) => setValue("diastolic", String(v))}
            unit="mmHg"
            formatNumber={(v) => String(Math.round(v))}
            valuePrefix="Dia: "
            statusLabel={bpStatus?.label}
            error={errors.diastolic?.message}
          />
          {latest.blood_pressure && (
            <p className="text-xs text-muted-foreground">
              Last recorded: {formatDateDMY(latest.blood_pressure.recorded_at)}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <VitalsSlider
            label="Cholesterol (total)"
            value={cholNum}
            min={cholBounds.min}
            max={cholBounds.max}
            step={cholBounds.step}
            tone={cholStatus?.tone ?? "good"}
            onChange={(v) => setValue("cholesterol_total", String(v))}
            unit={cholUnit}
            formatNumber={(v) => formatNumber(v, cholUnit)}
            statusLabel={cholStatus?.label}
            error={errors.cholesterol_total?.message}
            help={CHOLESTEROL_HELP}
            trailing={
              <UnitToggle
                options={UNIT_OPTIONS}
                value={cholUnit}
                onChange={handleCholesterolUnitChange}
                ariaLabel="Cholesterol unit"
              />
            }
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

      <div className="flex justify-between items-start gap-2 rounded-2xl border border-border bg-surface-muted px-4 py-3">
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
