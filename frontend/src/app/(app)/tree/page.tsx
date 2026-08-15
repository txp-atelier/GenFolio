import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import { backendFetch } from "@/lib/session";

import { FamilyTreeView } from "./FamilyTreeView";
import type { FamilyGraphResponse } from "./types";

export default async function TreePage() {
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
  const ego = graph.persons.find((p) => p.is_self);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <h1 className="text-xl font-semibold text-foreground">
        {ego ? `${ego.first_name} ${ego.last_name}'s family tree` : "Family tree"}
      </h1>

      <FamilyTreeView persons={graph.persons} egoPersonId={graph.ego_person_id} />
    </main>
  );
}
