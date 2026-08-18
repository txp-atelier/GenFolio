/** A backend outage (e.g. the process crashing mid-request) leaves a plain
 * `fetch` pending forever — no error, no response, just an infinite spinner.
 * This aborts the request after `timeoutMs` so the UI can show a real error
 * instead. Defaults to 30s: generous enough for a normal LLM-backed answer,
 * bounded enough that "stuck" always resolves into "failed". */
export class FetchTimeoutError extends Error {
  constructor() {
    super("Request timed out");
    this.name = "FetchTimeoutError";
  }
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 30_000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new FetchTimeoutError();
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
