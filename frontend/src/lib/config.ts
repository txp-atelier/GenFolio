// Server-side calls (Server Components, Route Handlers) reach the backend
// over the docker-compose network; the browser reaches it via the published
// port on localhost. Keep these separate so each context uses a URL it can
// actually resolve.
export const BACKEND_INTERNAL_URL =
  process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";

export const NEXT_PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
