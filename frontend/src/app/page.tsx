import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { BACKEND_INTERNAL_URL } from "@/lib/config";

async function getBackendStatus(): Promise<string> {
  try {
    const res = await fetch(`${BACKEND_INTERNAL_URL}/health`, {
      cache: "no-store",
    });
    if (!res.ok) return "unreachable";
    const data = (await res.json()) as { status: string };
    return data.status;
  } catch {
    return "unreachable";
  }
}

export default async function Home() {
  const backendStatus = await getBackendStatus();
  const ok = backendStatus === "ok";

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">FamilyTree</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Map your family, track shared health history, and ask a chatbot what runs in the family.
      </p>

      <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-success" : "bg-danger"}`} />
        Backend {ok ? "connected" : "unreachable"}
      </div>

      <div className="flex gap-3">
        <Link href="/register">
          <Button>Create a family</Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary">Log in</Button>
        </Link>
      </div>
    </main>
  );
}
