import { forwardRef, type InputHTMLAttributes } from "react";

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
      <input
        ref={ref}
        id={fieldId}
        type="checkbox"
        className={`mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-border-strong text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${className}`}
        {...rest}
      />
      <span className="flex flex-col">
        <span className="text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
});
