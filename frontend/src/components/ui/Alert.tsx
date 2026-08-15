import type { ReactNode } from "react";

type Variant = "error" | "success" | "info" | "warning";

const variants: Record<Variant, string> = {
  error: "border-danger-border bg-danger-muted text-danger",
  success: "border-success-border bg-success-muted text-success",
  info: "border-border bg-surface-muted text-foreground",
  warning: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
};

export function Alert({
  variant = "info",
  children,
}: {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border px-3.5 py-2.5 text-sm ${variants[variant]}`}
      role={variant === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
