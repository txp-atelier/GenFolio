"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";

import { HealthRecordForm } from "./HealthRecordForm";
import { HealthRecordList } from "./HealthRecordList";
import type { HealthRecord } from "./types";

const QUERY_KEY = ["health-records"];

function summarizeError(data: unknown): string {
  if (typeof data === "object" && data !== null && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((e: { loc?: unknown[]; msg?: string }) => {
          const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : "value";
          return `${field}: ${e.msg}`;
        })
        .join(", ");
    }
  }
  return "Something went wrong";
}

async function fetchRecords(): Promise<HealthRecord[]> {
  const res = await fetch("/api/health-records");
  if (!res.ok) throw new Error("Could not load health records");
  return res.json();
}

type CreatePayload = {
  category: string;
  value: Record<string, unknown>;
  recorded_at?: string;
  visible_to_family?: boolean;
};
type UpdatePayload = {
  value?: Record<string, unknown>;
  recorded_at?: string;
  visible_to_family?: boolean;
};

export function HealthRecordsClient() {
  const queryClient = useQueryClient();
  const [editingRecord, setEditingRecord] = useState<HealthRecord | null>(null);

  const {
    data: records,
    isLoading,
    error: loadError,
  } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchRecords });

  const createMutation = useMutation({
    mutationFn: async (payload: CreatePayload) => {
      const res = await fetch("/api/health-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(summarizeError(await res.json().catch(() => ({}))));
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdatePayload }) => {
      const res = await fetch(`/api/health-records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(summarizeError(await res.json().catch(() => ({}))));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setEditingRecord(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/health-records/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Could not delete record");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-foreground">Health records</h1>

      <Card>
        <HealthRecordForm
          key={editingRecord?.id ?? "new"}
          record={editingRecord ?? undefined}
          submitting={createMutation.isPending || updateMutation.isPending}
          error={
            (createMutation.error as Error | null)?.message ??
            (updateMutation.error as Error | null)?.message ??
            null
          }
          onCancelEdit={editingRecord ? () => setEditingRecord(null) : undefined}
          onSubmit={async (payload) => {
            if (editingRecord) {
              await updateMutation.mutateAsync({ id: editingRecord.id, payload });
            } else {
              await createMutation.mutateAsync(payload as CreatePayload);
            }
          }}
        />
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {loadError && <Alert variant="error">Could not load health records.</Alert>}

      {records && (
        <HealthRecordList
          records={records}
          onEdit={setEditingRecord}
          onDelete={(id) => deleteMutation.mutate(id)}
          deletingId={deleteMutation.isPending ? (deleteMutation.variables as string) : undefined}
        />
      )}
    </main>
  );
}
