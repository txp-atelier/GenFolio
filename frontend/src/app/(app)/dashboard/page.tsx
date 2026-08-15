"use client";

import Link from "next/link";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/ui/Card";
import { useUser } from "@/lib/UserContext";

import { InviteForm } from "./InviteForm";

const SHORTCUTS = [
  {
    href: "/tree",
    title: "Family Tree",
    description: "See how everyone in your family connects.",
    icon: (
      <path d="M12 3v6m0 0-4 4m4-4 4 4M6 21v-4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4M4 21h16" />
    ),
  },
  {
    href: "/health",
    title: "Health Records",
    description: "Log blood sugar, blood pressure, and conditions.",
    icon: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.6Z" />,
  },
  {
    href: "/chat",
    title: "Health Chat",
    description: "Ask what patterns run in your family.",
    icon: (
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    ),
  },
];

export default function DashboardPage() {
  const me = useUser();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <Card className="flex items-center gap-4">
        <Avatar url={me.profile_picture_url} firstName={me.first_name} lastName={me.last_name} size={64} />
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Welcome back, {me.first_name}
          </h1>
          <p className="text-sm text-muted-foreground">{me.family_name}</p>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {SHORTCUTS.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="flex h-full flex-col gap-3 transition-shadow group-hover:shadow-md">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-primary"
              >
                {s.icon}
              </svg>
              <div>
                <h2 className="text-sm font-semibold text-foreground">{s.title}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{s.description}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <InviteForm />
    </main>
  );
}
