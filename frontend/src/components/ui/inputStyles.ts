export function inputClass(hasError?: boolean, extra = ""): string {
  return [
    "w-full min-w-0 rounded-2xl border bg-surface px-4 py-3 text-sm text-foreground",
    "placeholder:text-muted-foreground",
    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background",
    hasError
      ? "border-danger-border focus:border-danger focus:ring-danger"
      : "border-border focus:border-ring focus:ring-ring",
    "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60",
    extra,
  ].join(" ");
}
