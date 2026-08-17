"use client";

import { useEffect, useState } from "react";

import {
  AddPersonIllustration,
  ConnectIllustration,
  HeartPulseIllustration,
  TreeSproutIllustration,
} from "@/components/illustrations/Illustrations";
import { Button } from "@/components/ui/Button";

const STORAGE_KEY = "familytree_onboarding_dismissed_v1";

const STEPS = [
  {
    illustration: <TreeSproutIllustration />,
    title: "This is your family tree",
    body: "Everyone you add shows up here, connected by lines — parents above, children below, and people your age right in the middle.",
  },
  {
    illustration: <AddPersonIllustration />,
    title: "Add your first family member",
    body: "Tap “Add a family member” and tell us how they're related to you. We'll create a link you can send them to join and fill in their own details.",
  },
  {
    illustration: <ConnectIllustration />,
    title: "Relationships connect on their own",
    body: "Once someone joins as your parent, sibling, child, or spouse, we work out the rest — grandparents, cousins, in-laws — so you never have to.",
  },
  {
    illustration: <HeartPulseIllustration />,
    title: "Discover health patterns together",
    body: "Log your own health notes and see what runs in the family. You choose what's shared, and it's only ever visible to your relatives.",
  },
];

/** A short, skippable first-look at the app — shown once, the first time
 * someone lands on their home screen. Never blocks anything; closing it
 * (however that happens) just remembers not to show it again. */
export function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Reads a browser-only API to decide first-time visibility — rendering
    // hidden-by-default on the server and flipping on mount is the correct
    // way to avoid a hydration mismatch here, not a case the "don't setState
    // in an effect" rule is meant to catch.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage unavailable (private browsing, etc.) — just skip the tour.
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Nothing to persist to — the tour will just show again next visit.
    }
    setVisible(false);
  }

  if (!visible) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="animate-rise-in flex w-full max-w-md flex-col items-center gap-5 rounded-3xl border border-border bg-surface p-8 text-center shadow-lg"
      >
        {current.illustration}

        <div className="flex flex-col gap-2">
          <h2 id="onboarding-title" className="font-heading text-xl font-semibold text-foreground">
            {current.title}
          </h2>
          <p className="text-sm text-muted-foreground">{current.body}</p>
        </div>

        <div className="flex items-center gap-1.5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-border-strong"
              }`}
            />
          ))}
        </div>

        <div className="mt-2 flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full px-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            <Button type="button" onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}>
              {isLast ? "Get started" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
