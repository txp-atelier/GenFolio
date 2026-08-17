"use client";

import { useEffect } from "react";

import { Button } from "./Button";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** A plain-language confirmation for anything that can't be easily undone —
 * deleting, clearing, or merging. Always says what will happen in everyday
 * words, never "Are you sure?" alone. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Yes, continue",
  cancelLabel = "Cancel",
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="animate-rise-in w-full max-w-sm rounded-3xl border border-border bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="font-heading text-lg font-semibold text-foreground">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
