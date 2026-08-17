/** Turns a FastAPI error body (`{detail: string | ValidationErrorItem[]}`)
 * into a single display string. Shared by every client-side mutation that
 * hits our API route handlers, which all forward the backend's error shape
 * through unchanged. */
export function summarizeApiError(data: unknown): string {
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
  return "Something went wrong on our end — please try again.";
}
