"use client";

export type TabOption = { value: string; label: string };

type Props = {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
};

/** A small pill-style tab switcher — same visual language as NavBar's active
 * nav link (bg-primary/10 text-primary-text). Two tabs today (Vitals / My
 * details on the health report page) but written generically. */
export function Tabs({ options, value, onChange, ariaLabel }: Props) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex gap-1 rounded-full bg-surface-muted p-1"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          onClick={() => onChange(opt.value)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            opt.value === value
              ? "bg-surface text-primary-text shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
