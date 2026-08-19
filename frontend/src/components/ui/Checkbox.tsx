import { forwardRef, type InputHTMLAttributes } from "react";

import { CheckIcon } from "@/components/icons";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export const Checkbox = forwardRef<HTMLInputElement, Props>(function Checkbox(
  { label, hint, id, className = "", ...rest },
  ref
) {
  const fieldId = id ?? rest.name;
  return (
    <label htmlFor={fieldId} className="flex cursor-pointer items-start gap-2.5 text-sm">
      {/* className goes on this wrapper, not the input — the checkmark icon
          below is a sibling absolutely positioned relative to *this* box,
          so putting a caller's spacing class (e.g. mt-0.5) on the input
          alone shifts the visible checkbox without moving the icon over
          it, leaving the tick visibly off-center. */}
      <span className={`relative mt-0.5 inline-flex h-5 w-5 shrink-0 ${className}`}>
        {/* Plain (non-positioned) input, so the absolutely-positioned check
            icon below always paints above it regardless of DOM order —
            positioned elements stack over static ones by default. */}
        <input
          ref={ref}
          id={fieldId}
          type="checkbox"
          className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-border-strong bg-surface transition-colors checked:border-primary checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          {...rest}
        />
        <CheckIcon
          width={13}
          height={13}
          strokeWidth={3.5}
          className="pointer-events-none absolute inset-0 m-auto text-primary-foreground opacity-0 transition-opacity peer-checked:opacity-100"
        />
      </span>
      <span className="flex flex-col">
        <span className="text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
});
