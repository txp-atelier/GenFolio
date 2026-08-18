"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AddPersonIcon, HeartPulseIcon, HomeIcon, SearchIcon, TreeIcon } from "@/components/icons";
import type { MeResponse } from "@/lib/types";

import { UserMenu } from "./UserMenu";

const NAV_LINKS = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/tree", label: "My Tree", icon: TreeIcon },
  { href: "/health", label: "Health Report", icon: HeartPulseIcon },
];

// Kept separate from NAV_LINKS: this is the one primary action every screen
// should make obvious, so it always renders as an emphasized pill/button
// rather than another plain link.
const ADD_PERSON = { href: "/add", label: "Add Person" };

const MOBILE_TABS = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/tree", label: "My Tree", icon: TreeIcon },
  { href: "/add", label: "Add", icon: AddPersonIcon, emphasized: true },
  { href: "/health", label: "Health", icon: HeartPulseIcon },
  { href: "/search", label: "Search", icon: SearchIcon },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavBar({ me }: { me: MeResponse }) {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur supports-backdrop-blur:bg-background/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2 font-heading text-base font-bold text-foreground">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground"
                style={{ background: "var(--primary)" }}
              >
                <TreeIcon width={18} height={18} stroke="currentColor" />
              </span>
              <span className="hidden sm:inline">GenFolio</span>
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ${
                    isActive(pathname, link.href)
                      ? "bg-primary/10 text-primary-text"
                      : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/search"
              aria-label="Search for someone in your family"
              className="hidden h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-foreground sm:flex"
            >
              <SearchIcon width={19} height={19} />
            </Link>
            <Link
              href={ADD_PERSON.href}
              className="hidden items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-hover sm:inline-flex"
            >
              <AddPersonIcon width={17} height={17} />
              Add a family member
            </Link>
            <UserMenu me={me} />
          </div>
        </div>
      </header>

      {/* Mobile primary navigation lives at the thumb, not scrolled off the top. */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 flex items-stretch justify-around border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-backdrop-blur:bg-surface/80 sm:hidden"
      >
        {MOBILE_TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          const Icon = tab.icon;
          if (tab.emphasized) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="flex flex-1 flex-col items-center justify-center gap-1 py-2"
              >
                <span className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                  <Icon width={22} height={22} />
                </span>
                <span className="text-[11px] font-semibold text-primary-text">{tab.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium ${
                active ? "text-primary-text" : "text-muted-foreground"
              }`}
            >
              <Icon width={21} height={21} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
