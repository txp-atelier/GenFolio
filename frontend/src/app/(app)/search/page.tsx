import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import { backendFetch } from "@/lib/session";
import type { FamilyGraphResponse } from "@/app/(app)/tree/types";

import { SearchClient } from "./SearchClient";

export default async function SearchPage() {
  let res: Response;
  try {
    res = await backendFetch("/persons/me/family-graph");
  } catch {
    return <BackendErrorNotice />;
  }
  if (!res.ok) {
    return <BackendErrorNotice status={res.status} />;
  }

  const graph = (await res.json()) as FamilyGraphResponse;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Find someone</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search by name, or by health detail — try &quot;high blood sugar&quot; or &quot;who is bald&quot;.
        </p>
      </div>
      <SearchClient persons={graph.persons} egoPersonId={graph.ego_person_id} />
    </main>
  );
}
