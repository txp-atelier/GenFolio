import Link from "next/link";

import { AddPersonIcon } from "@/components/icons";
import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import { Button } from "@/components/ui/Button";
import { backendFetch } from "@/lib/session";

import { FamilyTreeView } from "./FamilyTreeView";
import type { FamilyGraphResponse } from "./types";

export default async function TreePage({ searchParams }: PageProps<"/tree">) {
  const params = await searchParams;
  const focusPersonId = typeof params.focus === "string" ? params.focus : undefined;

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
  const hasRelatives = graph.persons.length > 1;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-foreground">
            {ego ? `${ego.first_name} ${ego.last_name}'s family tree` : "Your family tree"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone connected to you, organized by generation.
          </p>
        </div>
        {hasRelatives && (
          <Link href="/add">
            <Button variant="secondary">
              <AddPersonIcon width={17} height={17} />
              Add a family member
            </Button>
          </Link>
        )}
      </div>

      <FamilyTreeView persons={graph.persons} egoPersonId={graph.ego_person_id} focusPersonId={focusPersonId} />
    </main>
  );
}
