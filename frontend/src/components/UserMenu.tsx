"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SettingsIcon } from "@/components/icons";
import type { MeResponse } from "@/lib/types";

import { Avatar } from "./Avatar";

export function UserMenu({ me }: { me: MeResponse }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Avatar url={me.profile_picture_url} firstName={me.first_name} lastName={me.last_name} size={36} />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-rise-in absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold text-foreground">
              {me.first_name} {me.last_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">{me.user.email}</p>
          </div>
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-surface-muted"
          >
            <SettingsIcon width={17} height={17} className="text-muted-foreground" />
            Settings
          </Link>
          <button
            role="menuitem"
            onClick={handleLogout}
            disabled={loggingOut}
            className="block w-full px-4 py-2.5 text-left text-sm text-danger hover:bg-danger-muted disabled:opacity-50"
          >
            {loggingOut ? "Signing you out…" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}
