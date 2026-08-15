"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { MeResponse } from "@/lib/types";

import { UserMenu } from "./UserMenu";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tree", label: "Family Tree" },
  { href: "/health", label: "Health Records" },
  { href: "/chat", label: "Health Chat" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavBar({ me }: { me: MeResponse }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur supports-backdrop-blur:bg-surface/70">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-base font-semibold text-foreground">
            FamilyTree
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive(pathname, link.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <UserMenu me={me} />
      </div>

      <nav className="custom-scrollbar flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-2 sm:hidden">
        {NAV_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
              isActive(pathname, link.href)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
