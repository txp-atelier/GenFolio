import { summarizeApiError } from "@/lib/apiError";

import type { HealthRecord, HealthRecordCategory } from "./types";

/** Shared health-records data access — used by both the Vitals tab
 * (blood sugar / pressure / cholesterol) and the My details tab (the
 * "other" notes record), so the two never drift in how they read or write
 * the same `/api/health-records` resource. */

export const HEALTH_RECORDS_QUERY_KEY = ["health-records"];

export async function fetchHealthRecords(): Promise<HealthRecord[]> {
  const res = await fetch("/api/health-records");
  if (!res.ok) throw new Error("We couldn't load your health records — please refresh the page.");
  return res.json();
}

export function latestByCategory(
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

export async function upsertHealthCategory(
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

export async function deleteHealthRecord(recordId: string) {
  const res = await fetch(`/api/health-records/${recordId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    throw new Error("We couldn't clear that — please try again.");
  }
}
