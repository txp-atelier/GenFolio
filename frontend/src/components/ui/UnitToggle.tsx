"use client";

type Props<T extends string> = {
  options: readonly [T, T];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
};

/** Pill-shaped two-option switch — e.g. mg/dL vs mmol/L — for the value it
 * sits next to. Not a generic radio group: only ever two options, styled to
 * read as a single toggle rather than a list. */
export function UnitToggle<T extends string>({ options, value, onChange, ariaLabel }: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex shrink-0 rounded-full bg-surface-muted p-1 text-xs font-semibold"
    >
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          role="radio"
          aria-checked={opt === value}
          onClick={() => onChange(opt)}
          className={`rounded-full px-2.5 py-1 transition-colors ${
            opt === value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
