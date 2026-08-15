import { forwardRef, type InputHTMLAttributes } from "react";

import { FormField } from "./FormField";
import { inputClass } from "./inputStyles";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
};

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, required, error, hint, id, className = "", type, onWheel, ...rest },
  ref
) {
  const fieldId = id ?? rest.name;
  return (
    <FormField label={label} htmlFor={fieldId} required={required} error={error} hint={hint}>
      <input
        ref={ref}
        id={fieldId}
        type={type}
        className={inputClass(!!error, className)}
        aria-invalid={!!error}
        onWheel={(e) => {
          // Prevent the browser's default "scroll to change value" behavior
          // on number inputs by dropping focus before it can act.
          if (type === "number") e.currentTarget.blur();
          onWheel?.(e);
        }}
        {...rest}
      />
    </FormField>
  );
});
