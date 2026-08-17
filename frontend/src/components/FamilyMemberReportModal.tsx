"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";

import { Avatar } from "@/components/Avatar";
import { CloseIcon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { formatDateDMY } from "@/lib/formatDate";
import { asString, formatBloodPressure, formatBloodSugar, formatCholesterol, genderLabel } from "@/lib/healthFormat";
import type { FamilyMemberReport, HealthReportRecord } from "@/lib/types";

async function fetchFamilyMemberReport(personId: string): Promise<FamilyMemberReport> {
  const res = await fetch(`/api/health-records/family/${personId}`);
  if (!res.ok) throw new Error("We couldn't load that report — please try again.");
  return res.json();
}

type Props = {
  /** null keeps the modal unmounted — pass a person_id to open it. */
  personId: string | null;
  onClose: () => void;
};

/** Read-only popup for viewing another family member's health report,
 * opened by clicking their card anywhere in the app (compare results, the
 * tree, search). Only ever shows what they've marked visible_to_family —
 * enforced server-side, not just hidden in the UI. */
export function FamilyMemberReportModal({ personId, onClose }: Props) {
  const pathname = usePathname();
  const { data, isLoading, error } = useQuery({
    queryKey: ["health-records", "family", personId],
    queryFn: () => fetchFamilyMemberReport(personId as string),
    enabled: personId !== null,
  });

  if (!personId) return null;
  const onTreePage = pathname.startsWith("/tree");

  // Portaled to <body> so this always paints above the navbar: several
  // callers (e.g. the health chat panel) render this inside a `position:
  // sticky` ancestor, which starts its own stacking context and traps a
  // merely-higher z-index underneath the navbar regardless of its value.
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="animate-rise-in flex max-h-[85vh] w-full max-w-md flex-col gap-6 overflow-y-auto rounded-3xl border border-border bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          {data ? (
            <div className="flex items-center gap-3">
              <Avatar
                url={data.profile_picture_url}
                firstName={data.first_name}
                lastName={data.last_name}
                size={56}
              />
              <div>
                <h2 className="font-heading text-base font-semibold text-foreground">
                  {data.first_name} {data.last_name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {genderLabel(data.sex)}
                  {data.age !== null ? ` · ${data.age} years old` : ""}
                </p>
              </div>
            </div>
          ) : (
            <h2 className="font-heading text-base font-semibold text-foreground">Health report</h2>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <CloseIcon width={16} height={16} />
          </button>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading report…</p>}
        {error && <Alert variant="error">{(error as Error).message}</Alert>}

        {data && (
          <>
            <dl className="flex flex-col divide-y divide-border">
              <ReportRow label="Blood sugar" record={data.blood_sugar} format={formatBloodSugar} />
              <ReportRow label="Blood pressure" record={data.blood_pressure} format={formatBloodPressure} />
              <ReportRow label="Cholesterol" record={data.cholesterol} format={formatCholesterol} />
            </dl>

            <div>
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Other health notes
              </h3>
              <p className="mt-2 text-sm text-foreground">
                {data.other ? asString(data.other.value.notes) || "No notes recorded." : "Not shared with family."}
              </p>
            </div>

            {!onTreePage && (
              <Link
                href={`/tree?focus=${data.person_id}`}
                onClick={onClose}
                className="text-sm font-medium text-primary-text hover:underline"
              >
                View in family tree
              </Link>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

type ReportRowProps = {
  label: string;
  record: HealthReportRecord | null;
  format: (value: Record<string, unknown>) => string;
};

function ReportRow({ label, record, format }: ReportRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="text-right">
        <p className="text-sm text-foreground">{record ? format(record.value) : "Not shared with family"}</p>
        {record && (
          <p className="text-xs text-muted-foreground">Last recorded: {formatDateDMY(record.recorded_at)}</p>
        )}
      </div>
    </div>
  );
}
