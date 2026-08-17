"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "danger" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-background disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
  secondary: "border border-border-strong bg-surface text-foreground hover:bg-surface-muted",
  danger: "bg-danger text-white hover:bg-danger-hover shadow-sm",
  ghost: "text-foreground hover:bg-surface-muted",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", loading = false, disabled, className = "", children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      // Only fade opacity for a genuinely unavailable button — a loading
      // button is actively doing something and should stay fully readable,
      // not wash out into low-contrast text.
      className={`${base} ${variants[variant]} ${disabled && !loading ? "opacity-50" : ""} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});
