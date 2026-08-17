import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { BackendErrorNotice } from "@/components/BackendErrorNotice";
import { NavBar } from "@/components/NavBar";
import { backendFetch } from "@/lib/session";
import type { MeResponse } from "@/lib/types";
import { UserProvider } from "@/lib/UserContext";

export default async function AppLayout({ children }: { children: ReactNode }) {
  let res: Response;
  try {
    res = await backendFetch("/auth/me");
  } catch {
    return <BackendErrorNotice />;
  }

  if (res.status === 401) {
    redirect("/login");
  }
  if (!res.ok) {
    return <BackendErrorNotice status={res.status} />;
  }

  const me = (await res.json()) as MeResponse;

  return (
    <UserProvider me={me}>
      <NavBar me={me} />
      {/* Bottom padding clears the fixed mobile tab bar so the last bit of
          content is never hidden behind it. */}
      <div className="flex flex-1 flex-col pb-20 sm:pb-0">{children}</div>
    </UserProvider>
  );
}
