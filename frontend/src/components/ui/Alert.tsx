import type { ReactNode } from "react";

type Variant = "error" | "success" | "info" | "warning";

// Every variant here means something real: error/success are the only two
// that borrow "debug console" red/green, and only ever for a genuine failed
// or confirmed action — never as decoration.
const variants: Record<Variant, string> = {
  error: "border-danger-border bg-danger-muted text-danger",
  success: "border-success-border bg-success-muted text-success",
  info: "border-border bg-surface-muted text-foreground",
  warning: "border-warning-border bg-warning-muted text-warning",
};

const icons: Record<Variant, ReactNode> = {
  error: (
    <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
  ),
  success: <path d="m9 12 2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  info: <path d="M12 16v-4m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  warning: <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />,
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
      className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm ${variants[variant]}`}
      role={variant === "error" ? "alert" : "status"}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0"
        aria-hidden="true"
      >
        {icons[variant]}
      </svg>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
