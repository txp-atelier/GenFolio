"use client";

import { useState } from "react";

import { ChatIcon } from "@/components/icons";

import { HealthChatPanel } from "./HealthChatPanel";
import { HealthReport } from "./HealthReport";

export function HealthRecordsClient() {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-foreground">Your health report</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep track of the numbers that matter, and see what runs in the family.
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-6">
        <HealthReport />

        {/* Mobile-only backdrop behind the popped-up chat panel. */}
        {chatOpen && (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
            onClick={() => setChatOpen(false)}
          />
        )}

        {/* One HealthChatPanel instance, repositioned by breakpoint: an
            always-visible sticky column on large screens, a full-screen
            popup toggled by the floating button on small ones. */}
        <div
          className={
            chatOpen
              ? "fixed inset-4 z-50 flex lg:static lg:inset-auto lg:z-auto lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]"
              : "hidden lg:sticky lg:top-24 lg:z-auto lg:flex lg:h-[calc(100vh-8rem)]"
          }
        >
          <HealthChatPanel onClose={() => setChatOpen(false)} />
        </div>
      </div>

      {/* Floating chat launcher — small screens only; on large screens the
          panel is already visible alongside the report. */}
      <button
        type="button"
        aria-label="Open family health chat"
        onClick={() => setChatOpen(true)}
        className="fixed right-5 bottom-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary-hover lg:hidden"
      >
        <ChatIcon width={24} height={24} />
      </button>
    </main>
  );
}
