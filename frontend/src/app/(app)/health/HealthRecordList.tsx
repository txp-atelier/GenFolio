"use client";

import { Button } from "@/components/ui/Button";
import { formatDateDMY } from "@/lib/formatDate";

import type { HealthRecord } from "./types";

type Props = {
  records: HealthRecord[];
  onEdit: (record: HealthRecord) => void;
  onDelete: (id: string) => void;
  deletingId?: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  blood_sugar: "Blood sugar",
  blood_pressure: "Blood pressure",
  cholesterol: "Cholesterol",
  condition: "Condition",
  other: "Other",
};

function summarize(record: HealthRecord): string {
  const v = record.value;
  switch (record.category) {
    case "blood_sugar":
      return `${String(v.value)} ${String(v.unit)}${
        v.context ? ` (${String(v.context).replace("_", " ")})` : ""
      }`;
    case "blood_pressure":
      return `${String(v.systolic)}/${String(v.diastolic)} ${String(v.unit)}`;
    case "cholesterol": {
      const parts: string[] = [];
      if (v.total !== undefined) parts.push(`Total ${String(v.total)}`);
      if (v.hdl !== undefined) parts.push(`HDL ${String(v.hdl)}`);
      if (v.ldl !== undefined) parts.push(`LDL ${String(v.ldl)}`);
      if (v.triglycerides !== undefined) parts.push(`Trig ${String(v.triglycerides)}`);
      return parts.join(", ") || "No values recorded";
    }
    case "condition":
    case "other":
      return String(v.name);
    default:
      return "";
  }
}

export function HealthRecordList({ records, onEdit, onDelete, deletingId }: Props) {
  if (records.length === 0) {
    return <p className="text-sm text-muted-foreground">No health records yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {records.map((record) => (
        <li
          key={record.id}
          className="flex flex-col gap-1 rounded-lg border border-border bg-surface px-4 py-3 text-sm shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-medium text-foreground">
              {CATEGORY_LABELS[record.category]}
              {!record.visible_to_family && (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  Private
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">{formatDateDMY(record.recorded_at)}</span>
          </div>
          <p className="text-foreground">{summarize(record)}</p>
          {typeof record.value.notes === "string" && record.value.notes && (
            <p className="text-xs text-muted-foreground">{record.value.notes}</p>
          )}
          <div className="flex gap-2 pt-1.5">
            <Button variant="secondary" onClick={() => onEdit(record)} className="px-3 py-1.5 text-xs">
              Edit
            </Button>
            <Button
              variant="danger"
              onClick={() => onDelete(record.id)}
              loading={deletingId === record.id}
              className="px-3 py-1.5 text-xs"
            >
              Delete
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
