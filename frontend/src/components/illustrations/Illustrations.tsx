/** Small, warm line-art illustrations used across empty states and
 * onboarding. Hand-drawn with plain SVG (no external assets/libraries) so
 * they stay lightweight and theme with the rest of the app. Every shape is
 * decorative only — never the sole carrier of information. */

type Props = { size?: number; className?: string };

// The app's one tree illustration (homepage hero, the empty-tree state,
// onboarding's first step) — an actual branching tree, not a canopy
// silhouette with dots pinned on: a trunk forks into two boughs (parents),
// each bough forks again into two twigs (grandparents), the exact shape of
// a pedigree chart, every person's two branches leading up to two more.
// Small root flares at the base echo the banyan mark used for the logo
// (NavBar, AuthCard) without repeating its solid-canopy composition.
export function BanyanTreeIllustration({ size = 112, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="60" cy="108" rx="24" ry="4" fill="var(--border)" />

      {/* roots — a small nod to the banyan mark, not the focal shape here */}
      <path
        d="M52 106c-2-6-1-11 2-15M68 106c2-6 1-11-2-15"
        stroke="var(--border-strong)"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.7"
      />

      {/* trunk → 2 parent boughs → 4 grandparent twigs */}
      <path d="M60 104V78" stroke="var(--border-strong)" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M60 78C46 72 40 64 36 54M60 78C74 72 80 64 84 54"
        stroke="var(--border-strong)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <path
        d="M36 54C28 46 22 38 18 28M36 54C40 46 44 38 46 28M84 54C80 46 76 38 74 28M84 54C92 46 98 38 100 28"
        stroke="var(--border-strong)"
        strokeWidth="3"
        strokeLinecap="round"
      />

      <circle cx="60" cy="80" r="17" fill="var(--gen-self)" opacity="0.25" />
      <circle cx="60" cy="80" r="12" fill="var(--gen-self)" />

      <circle cx="36" cy="54" r="14" fill="var(--gen-up1)" opacity="0.25" />
      <circle cx="36" cy="54" r="10" fill="var(--gen-up1)" />
      <circle cx="84" cy="54" r="14" fill="var(--gen-up1)" opacity="0.25" />
      <circle cx="84" cy="54" r="10" fill="var(--gen-up1)" />

      <circle cx="18" cy="28" r="10" fill="var(--gen-up2)" opacity="0.25" />
      <circle cx="18" cy="28" r="7" fill="var(--gen-up2)" />
      <circle cx="46" cy="28" r="10" fill="var(--gen-up2)" opacity="0.25" />
      <circle cx="46" cy="28" r="7" fill="var(--gen-up2)" />
      <circle cx="74" cy="28" r="10" fill="var(--gen-up2)" opacity="0.25" />
      <circle cx="74" cy="28" r="7" fill="var(--gen-up2)" />
      <circle cx="100" cy="28" r="10" fill="var(--gen-up2)" opacity="0.25" />
      <circle cx="100" cy="28" r="7" fill="var(--gen-up2)" />
    </svg>
  );
}

export function AddPersonIllustration({ size = 112, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="46" fill="var(--surface-muted)" />
      <circle cx="60" cy="47" r="16" fill="var(--gen-self)" opacity="0.85" />
      <path d="M32 92c3-16 13-24 28-24s25 8 28 24" fill="var(--gen-self)" opacity="0.85" />
      <circle cx="93" cy="33" r="16" fill="var(--surface)" stroke="var(--gen-down1)" strokeWidth="3" />
      <path d="M93 26v14M86 33h14" stroke="var(--gen-down1)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function ConnectIllustration({ size = 112, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="34" cy="60" r="24" fill="var(--gen-up1)" opacity="0.85" />
      <circle cx="86" cy="60" r="24" fill="var(--gen-peer)" opacity="0.85" />
      <path
        d="M52 60c4-10 12-10 16 0s12 10 16 0"
        stroke="var(--surface)"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

export function HeartPulseIllustration({ size = 112, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="60" cy="60" r="46" fill="var(--surface-muted)" />
      <path
        d="M60 82S34 66 34 47a15 15 0 0 1 26-10 15 15 0 0 1 26 10c0 19-26 35-26 35Z"
        fill="var(--gen-down1)"
        opacity="0.85"
      />
      <path
        d="M24 60h14l6-12 8 20 6-10h14"
        stroke="var(--surface)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CloudPauseIllustration({ size = 112, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M38 78a18 18 0 0 1-2-35.8A24 24 0 0 1 82 34a16 16 0 0 1 2 31.9"
        fill="var(--surface-muted)"
        stroke="var(--border-strong)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="60" cy="60" r="46" fill="none" />
      <rect x="52" y="86" width="6" height="16" rx="3" fill="var(--gen-up1)" />
      <rect x="64" y="86" width="6" height="16" rx="3" fill="var(--gen-up1)" />
    </svg>
  );
}

export function SearchIllustration({ size = 112, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle cx="52" cy="52" r="30" fill="var(--surface-muted)" stroke="var(--gen-up1)" strokeWidth="4" />
      <path d="M74 74l20 20" stroke="var(--gen-up1)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="52" cy="52" r="10" fill="var(--gen-self)" opacity="0.85" />
    </svg>
  );
}
