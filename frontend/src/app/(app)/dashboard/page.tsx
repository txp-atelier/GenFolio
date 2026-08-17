"use client";

import Link from "next/link";

import { AddPersonIcon, HeartPulseIcon, TreeIcon } from "@/components/icons";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/Button";
import { useUser } from "@/lib/UserContext";

const SHORTCUTS = [
  {
    href: "/tree",
    title: "My Tree",
    description: "See how everyone in your family connects, organized by generation.",
    icon: TreeIcon,
    colorVar: "gen-self",
  },
  {
    href: "/health",
    title: "Health Report",
    description: "Track your vitals, compare with family, and ask what runs in your genes.",
    icon: HeartPulseIcon,
    colorVar: "gen-down1",
  },
];

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function DashboardPage() {
  const me = useUser();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 p-4 sm:p-8">
      <OnboardingTour />

      {/* Header lives directly on the page — not boxed in a card — for a
          lighter, less "everything is a widget" feel. */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar url={me.profile_picture_url} firstName={me.first_name} lastName={me.last_name} size={56} />
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Welcome back, {me.first_name}
            </h1>
            <p className="text-sm text-muted-foreground">The {me.family_name} family</p>
          </div>
        </div>
        <Link href="/add" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">
            <AddPersonIcon width={17} height={17} />
            Add a family member
          </Button>
        </Link>
      </div>

      <div className="border-t border-border" />

      <div className="flex flex-col gap-4">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Quick access</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group relative flex items-start gap-4 rounded-3xl border border-border bg-surface p-5 pr-10 shadow-sm transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
            >
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
                style={{ background: `var(--${s.colorVar})` }}
              >
                <s.icon width={22} height={22} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-heading text-base font-semibold text-foreground">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
              </div>
              <span className="absolute top-5 right-5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100">
                <ArrowIcon />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
