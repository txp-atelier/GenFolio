"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Dropdown, type DropdownOption } from "@/components/Dropdown";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { DateField } from "@/components/ui/DateField";
import { TextareaField } from "@/components/ui/TextareaField";
import { TextField } from "@/components/ui/TextField";
import {
  buildHealthRecordValue,
  healthRecordFormSchema,
  type HealthRecordFormValues,
} from "@/lib/validation/health";

import type { HealthRecord, HealthRecordCategory } from "./types";

const CATEGORY_OPTIONS: DropdownOption[] = [
  { value: "blood_sugar", label: "Blood sugar" },
  { value: "blood_pressure", label: "Blood pressure" },
  { value: "cholesterol", label: "Cholesterol" },
  { value: "condition", label: "Condition / diagnosis" },
  { value: "other", label: "Other" },
];

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

const CATEGORY_LABELS: Record<string, string> = {
  blood_sugar: "Blood sugar",
  blood_pressure: "Blood pressure",
  cholesterol: "Cholesterol",
  condition: "Condition / diagnosis",
  other: "Other",
};

type FormPayload = {
  category?: HealthRecordCategory;
  value: Record<string, unknown>;
  recorded_at?: string;
  visible_to_family?: boolean;
};

type Props = {
  record?: HealthRecord;
  submitting: boolean;
  error: string | null;
  onSubmit: (payload: FormPayload) => Promise<void>;
  onCancelEdit?: () => void;
};

function asString(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

export function HealthRecordForm({ record, submitting, error, onSubmit, onCancelEdit }: Props) {
  const initial = record?.value ?? {};

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<HealthRecordFormValues>({
    resolver: zodResolver(healthRecordFormSchema),
    defaultValues: {
      category: record?.category ?? "blood_sugar",
      recorded_at: record ? record.recorded_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
      visible_to_family: record?.visible_to_family ?? true,

      sugar_value: asString(initial.value),
      // `initial.unit` only means "mg/dL | mmol/L" when the record being
      // edited actually IS that category — for any other category (e.g.
      // editing blood_pressure, whose own unit is "mmHg") these fields are
      // hidden and irrelevant, so they must fall back to a valid default
      // rather than inheriting a unit string that isn't a valid option here.
      sugar_unit: (record?.category === "blood_sugar" ? asString(initial.unit) || "mg/dL" : "mg/dL") as
        | "mg/dL"
        | "mmol/L",
      sugar_context: asString(initial.context) as "" | "fasting" | "post_meal" | "random",

      systolic: asString(initial.systolic),
      diastolic: asString(initial.diastolic),

      total: asString(initial.total),
      hdl: asString(initial.hdl),
      ldl: asString(initial.ldl),
      triglycerides: asString(initial.triglycerides),
      cholesterol_unit: (record?.category === "cholesterol" ? asString(initial.unit) || "mg/dL" : "mg/dL") as
        | "mg/dL"
        | "mmol/L",

      name: asString(initial.name),
      diagnosed_date: asString(initial.diagnosed_date),
      notes: asString(initial.notes),
    },
  });

  const category = watch("category");

  async function onValid(values: HealthRecordFormValues) {
    const payload: FormPayload = {
      value: buildHealthRecordValue(values),
      recorded_at: values.recorded_at ? new Date(values.recorded_at).toISOString() : undefined,
      visible_to_family: values.visible_to_family,
    };
    if (!record) {
      payload.category = values.category;
    }
    await onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4" noValidate>
      <h2 className="text-lg font-semibold text-foreground">
        {record ? "Edit record" : "Add a health record"}
      </h2>

      {record ? (
        <div>
          <span className="text-sm font-medium text-foreground">Category</span>
          <p className="mt-1.5 text-sm text-muted-foreground">{CATEGORY_LABELS[record.category]}</p>
          {/* Category is immutable once a record exists (the backend's
              UpdateHealthRecordRequest doesn't accept it), but it still has
              to be a genuinely registered field — not just a defaultValues
              entry — so its value reliably survives to the validated
              submission and buildHealthRecordValue picks the right shape. */}
          <input type="hidden" {...register("category")} />
        </div>
      ) : (
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Dropdown
              label="Category"
              required
              options={CATEGORY_OPTIONS}
              value={field.value}
              onChange={(v) => field.onChange(v as HealthRecordCategory)}
            />
          )}
        />
      )}

      <Controller
        name="recorded_at"
        control={control}
        render={({ field }) => (
          <DateField
            label="Date"
            required
            value={field.value}
            onChange={field.onChange}
            error={errors.recorded_at?.message}
          />
        )}
      />

      {category === "blood_sugar" && (
        <>
          <div className="flex gap-3">
            <div className="min-w-0 flex-1">
              <TextField
                label="Value"
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
                  <Dropdown label="Unit" required options={SUGAR_UNIT_OPTIONS} value={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          </div>
          <Controller
            name="sugar_context"
            control={control}
            render={({ field }) => (
              <Dropdown label="Context" hint="Optional" options={SUGAR_CONTEXT_OPTIONS} value={field.value} onChange={field.onChange} />
            )}
          />
        </>
      )}

      {category === "blood_pressure" && (
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <TextField label="Systolic" type="number" required error={errors.systolic?.message} {...register("systolic")} />
          </div>
          <div className="min-w-0 flex-1">
            <TextField label="Diastolic" type="number" required error={errors.diastolic?.message} {...register("diastolic")} />
          </div>
        </div>
      )}

      {category === "cholesterol" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Total" type="number" hint="Optional" error={errors.total?.message} {...register("total")} />
            <TextField label="HDL" type="number" hint="Optional" error={errors.hdl?.message} {...register("hdl")} />
            <TextField label="LDL" type="number" hint="Optional" error={errors.ldl?.message} {...register("ldl")} />
            <TextField
              label="Triglycerides"
              type="number"
              hint="Optional"
              error={errors.triglycerides?.message}
              {...register("triglycerides")}
            />
          </div>
          <Controller
            name="cholesterol_unit"
            control={control}
            render={({ field }) => (
              <Dropdown label="Unit" required options={SUGAR_UNIT_OPTIONS} value={field.value} onChange={field.onChange} />
            )}
          />
        </>
      )}

      {(category === "condition" || category === "other") && (
        <>
          <TextField
            label={category === "condition" ? "Condition name" : "Name"}
            required
            error={errors.name?.message}
            {...register("name")}
          />
          {category === "condition" && (
            <Controller
              name="diagnosed_date"
              control={control}
              render={({ field }) => (
                <DateField
                  label="Diagnosed on"
                  hint="Optional"
                  value={field.value}
                  onChange={field.onChange}
                  maxDate={new Date()}
                  error={errors.diagnosed_date?.message}
                />
              )}
            />
          )}
          <TextareaField label="Notes" hint="Optional" error={errors.notes?.message} {...register("notes")} />
        </>
      )}

      <Checkbox
        label="Visible to family"
        hint="Used by the family health chat"
        {...register("visible_to_family")}
      />

      {error && <Alert variant="error">{error}</Alert>}

      {!error && Object.keys(errors).length > 0 && (
        <Alert variant="error">
          Couldn&apos;t save — please fix:{" "}
          {Object.entries(errors)
            .map(([field, err]) => `${field}: ${(err as { message?: string })?.message ?? "invalid"}`)
            .join("; ")}
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" loading={submitting}>
          {record ? "Save changes" : "Add record"}
        </Button>
        {onCancelEdit && (
          <Button type="button" variant="secondary" onClick={onCancelEdit}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
