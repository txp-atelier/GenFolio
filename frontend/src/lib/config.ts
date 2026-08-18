// Server-side calls (Server Components, Route Handlers) reach the backend
// over the docker-compose network; the browser reaches it via the published
// port on localhost. Keep these separate so each context uses a URL it can
// actually resolve.
//
// Neither env var needs to be set explicitly in most cases: NODE_ENV is set
// by Next.js itself (dev server vs. production build), so the fallback below
// already points at the deployed Render API in production and localhost in
// development. Set BACKEND_INTERNAL_URL/NEXT_PUBLIC_API_URL only to override.
const PRODUCTION_BACKEND_URL = "https://genfolio-txp.onrender.com";
const isProduction = process.env.NODE_ENV === "production";

export const BACKEND_INTERNAL_URL =
  process.env.BACKEND_INTERNAL_URL ??
  (isProduction ? PRODUCTION_BACKEND_URL : "http://localhost:8000");

export const NEXT_PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (isProduction ? PRODUCTION_BACKEND_URL : "http://localhost:8000");
