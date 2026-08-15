import { forwardRef, type TextareaHTMLAttributes } from "react";

import { FormField } from "./FormField";
import { inputClass } from "./inputStyles";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
};

export const TextareaField = forwardRef<HTMLTextAreaElement, Props>(function TextareaField(
  { label, required, error, hint, id, className = "", rows = 3, ...rest },
  ref
) {
  const fieldId = id ?? rest.name;
  return (
    <FormField label={label} htmlFor={fieldId} required={required} error={error} hint={hint}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        className={inputClass(!!error, className)}
        aria-invalid={!!error}
        {...rest}
      />
    </FormField>
  );
});
