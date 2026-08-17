/** Small, warm line-art illustrations used across empty states and
 * onboarding. Hand-drawn with plain SVG (no external assets/libraries) so
 * they stay lightweight and theme with the rest of the app. Every shape is
 * decorative only — never the sole carrier of information. */

type Props = { size?: number; className?: string };

export function TreeSproutIllustration({ size = 112, className = "" }: Props) {
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
        d="M60 108V64"
        stroke="var(--border-strong)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M60 82c0-14-16-18-22-30M60 72c0-12 14-16 19-27M60 92c0-10-12-13-16-22"
        stroke="var(--border-strong)"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="60" cy="30" r="17" fill="var(--gen-self)" opacity="0.18" />
      <circle cx="60" cy="30" r="12" fill="var(--gen-self)" />
      <circle cx="30" cy="50" r="13" fill="var(--gen-up1)" opacity="0.18" />
      <circle cx="30" cy="50" r="9" fill="var(--gen-up1)" />
      <circle cx="91" cy="46" r="13" fill="var(--gen-down1)" opacity="0.18" />
      <circle cx="91" cy="46" r="9" fill="var(--gen-down1)" />
      <circle cx="42" cy="18" r="9" fill="var(--gen-peer)" opacity="0.18" />
      <circle cx="42" cy="18" r="6" fill="var(--gen-peer)" />
      <ellipse cx="60" cy="110" rx="30" ry="4" fill="var(--border)" />
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
