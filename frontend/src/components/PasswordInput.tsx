"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";

import { FormField } from "./ui/FormField";
import { inputClass } from "./ui/inputStyles";

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a13.16 13.16 0 0 1-3.19 4.19M6.61 6.61A13.16 13.16 0 0 0 1 12s4 8 11 8a9.26 9.26 0 0 0 5.39-1.61" />
      <path d="M9.53 9.53a3 3 0 0 0 4.24 4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { className = "", label, required, error, hint, id, ...props },
  ref
) {
  const [visible, setVisible] = useState(false);
  const fieldId = id ?? props.name;

  const field = (
    <div className="relative">
      <input
        ref={ref}
        id={fieldId}
        {...props}
        type={visible ? "text" : "password"}
        className={inputClass(!!error, `pr-10 ${className}`)}
        aria-invalid={!!error}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );

  if (!label) return field;

  return (
    <FormField label={label} htmlFor={fieldId} required={required} error={error} hint={hint}>
      {field}
    </FormField>
  );
});
