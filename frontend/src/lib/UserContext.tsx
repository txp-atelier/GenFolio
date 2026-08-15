"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { MeResponse } from "./types";

const UserContext = createContext<MeResponse | null>(null);

export function UserProvider({ me, children }: { me: MeResponse; children: ReactNode }) {
  return <UserContext.Provider value={me}>{children}</UserContext.Provider>;
}

/** Only usable inside the (app) route group's layout, which always provides
 * a value — see src/app/(app)/layout.tsx. */
export function useUser(): MeResponse {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser() must be used within the authenticated app layout");
  }
  return ctx;
}
