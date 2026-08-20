"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";

import { DocumentIcon, EditIcon, ImageFileIcon, TrashIcon, UploadIcon } from "@/components/icons";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { inputClass } from "@/components/ui/inputStyles";
import { summarizeApiError } from "@/lib/apiError";
import { formatDateDMY } from "@/lib/formatDate";

import type { HealthReportFile } from "./types";

const REPORTS_QUERY_KEY = ["health-report-files"];
const MAX_REPORT_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];

function isAcceptedFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

async function fetchReportFiles(): Promise<HealthReportFile[]> {
  const res = await fetch("/api/health-report-files");
  if (!res.ok) throw new Error("We couldn't load your reports — please refresh the page.");
  return res.json();
}

/** Upload/rename/delete area for the user's own health-report documents
 * (lab PDFs, scanned images, etc.) — lives at the bottom of the Vitals tab.
 * Deliberately simple: no drag-and-drop, no in-app preview, just a file
 * list with add/rename/delete and a link that opens the file itself. */
export function ReportsSection() {
  const queryClient = useQueryClient();
  const { data: files, isLoading, error: loadError } = useQuery({
    queryKey: REPORTS_QUERY_KEY,
    queryFn: fetchReportFiles,
  });

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEY });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Reports</h3>
        {!adding && (
          <Button type="button" variant="secondary" onClick={() => setAdding(true)} className="px-3 py-1.5 text-xs">
            Add report
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Keep your lab reports and scans in one place — upload a PDF, Word document, text file, or photo.
      </p>

      {adding && <AddReportForm onDone={() => setAdding(false)} onUploaded={invalidate} />}

      {isLoading && <p className="text-sm text-muted-foreground">Loading your reports…</p>}
      {loadError && <Alert variant="error">We couldn&apos;t load your reports — please refresh the page.</Alert>}

      {files && files.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">You haven&apos;t added any reports yet.</p>
      )}

      {files && files.length > 0 && (
        <ul className="flex flex-col divide-y divide-border">
          {files.map((file) =>
            editingId === file.id ? (
              <EditReportRow
                key={file.id}
                file={file}
                onDone={() => setEditingId(null)}
                onSaved={invalidate}
              />
            ) : (
              <ReportRow
                key={file.id}
                file={file}
                onEdit={() => setEditingId(file.id)}
                onDelete={() => setDeletingId(file.id)}
              />
            )
          )}
        </ul>
      )}

      <DeleteReportDialog fileId={deletingId} onClose={() => setDeletingId(null)} onDeleted={invalidate} />
    </div>
  );
}

function ReportRow({
  file,
  onEdit,
  onDelete,
}: {
  file: HealthReportFile;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = file.mime_type.startsWith("image/") ? ImageFileIcon : DocumentIcon;
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-muted-foreground">
        <Icon width={18} height={18} />
      </span>
      <a
        href={file.file_url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 hover:underline"
      >
        <p className="truncate text-sm font-medium text-foreground">{file.title}</p>
        <p className="text-xs text-muted-foreground">Added {formatDateDMY(file.uploaded_at)}</p>
      </a>
      <button
        type="button"
        aria-label={`Edit ${file.title}`}
        onClick={onEdit}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-foreground"
      >
        <EditIcon width={16} height={16} />
      </button>
      <button
        type="button"
        aria-label={`Delete ${file.title}`}
        onClick={onDelete}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-danger-muted hover:text-danger"
      >
        <TrashIcon width={16} height={16} />
      </button>
    </li>
  );
}

/** Inline edit for one report: rename it, and/or swap out its underlying
 * file entirely — picking a new file here replaces the old one on the same
 * entry (same id, refreshed "Added" date) rather than creating a second
 * report, and the old file is deleted from storage once the swap succeeds. */
function EditReportRow({
  file,
  onDone,
  onSaved,
}: {
  file: HealthReportFile;
  onDone: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(file.title);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmedTitle = title.trim();
      if (newFile) {
        const formData = new FormData();
        formData.append("file", newFile);
        if (trimmedTitle) formData.append("title", trimmedTitle);
        const res = await fetch(`/api/health-report-files/${file.id}/replace`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error(summarizeApiError(await res.json().catch(() => ({}))));
        return;
      }
      const res = await fetch(`/api/health-report-files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmedTitle }),
      });
      if (!res.ok) throw new Error(summarizeApiError(await res.json().catch(() => ({}))));
    },
    onSuccess: () => {
      onSaved();
      onDone();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleNewFileChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setError(null);
    if (!picked) {
      setNewFile(null);
      return;
    }
    if (!isAcceptedFile(picked)) {
      setError("Please choose a PDF, DOCX, TXT, or image file.");
      setNewFile(null);
      return;
    }
    if (picked.size > MAX_REPORT_FILE_BYTES) {
      setError("That file is larger than 10MB — please choose a smaller one.");
      setNewFile(null);
      return;
    }
    setNewFile(picked);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Enter a name for this report");
      return;
    }
    mutation.mutate();
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass(!!error, "py-2")}
          aria-label="Report name"
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor={`replace-file-${file.id}`}>
            Replace file <span className="font-normal">(optional — leave blank to just rename)</span>
          </label>
          <input
            ref={fileInputRef}
            id={`replace-file-${file.id}`}
            type="file"
            accept=".pdf,.docx,.txt,image/*"
            onChange={handleNewFileChange}
            className="text-xs text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary-hover"
          />
          {newFile && (
            <p className="text-xs text-muted-foreground">
              &quot;{file.original_filename}&quot; will be replaced with &quot;{newFile.name}&quot; and deleted.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" loading={mutation.isPending} className="px-3 py-2 text-xs">
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="secondary" onClick={onDone} disabled={mutation.isPending} className="px-3 py-2 text-xs">
            Cancel
          </Button>
        </div>
      </form>
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

function DeleteReportDialog({
  fileId,
  onClose,
  onDeleted,
}: {
  fileId: string | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/health-report-files/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        throw new Error("We couldn't delete that report — please try again.");
      }
    },
    onSuccess: () => {
      onDeleted();
      onClose();
    },
  });

  return (
    <ConfirmDialog
      open={fileId !== null}
      title="Delete this report?"
      description="This report will be removed from your health report. This can't be undone."
      confirmLabel="Yes, delete it"
      loading={mutation.isPending}
      onConfirm={() => fileId && mutation.mutate(fileId)}
      onCancel={onClose}
    />
  );
}

function AddReportForm({ onDone, onUploaded }: { onDone: () => void; onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose a file to upload");
      const formData = new FormData();
      formData.append("file", file);
      if (title.trim()) formData.append("title", title.trim());
      const res = await fetch("/api/health-report-files", { method: "POST", body: formData });
      if (!res.ok) throw new Error(summarizeApiError(await res.json().catch(() => ({}))));
    },
    onSuccess: () => {
      onUploaded();
      onDone();
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setError(null);
    if (!picked) {
      setFile(null);
      return;
    }
    if (!isAcceptedFile(picked)) {
      setError("Please choose a PDF, DOCX, TXT, or image file.");
      setFile(null);
      return;
    }
    if (picked.size > MAX_REPORT_FILE_BYTES) {
      setError("That file is larger than 10MB — please choose a smaller one.");
      setFile(null);
      return;
    }
    setFile(picked);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file to upload");
      return;
    }
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-muted p-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground" htmlFor="report-file-input">
          File
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">(PDF, DOCX, TXT, or image — up to 10MB)</span>
        </label>
        <input
          ref={fileInputRef}
          id="report-file-input"
          type="file"
          accept=".pdf,.docx,.txt,image/*"
          onChange={handleFileChange}
          className="text-sm text-foreground file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-primary-foreground hover:file:bg-primary-hover"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground" htmlFor="report-title-input">
          Name
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id="report-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={file?.name || "e.g. Blood test — Aug 2026"}
          className={inputClass(false)}
        />
      </div>

      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" loading={mutation.isPending} className="gap-1.5 px-4 py-2 text-xs">
          <UploadIcon width={15} height={15} />
          {mutation.isPending ? "Uploading…" : "Upload"}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={mutation.isPending} className="px-4 py-2 text-xs">
          Cancel
        </Button>
      </div>
    </form>
  );
}
