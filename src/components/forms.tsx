"use client";

import { useId } from "react";
import { useFormStatus } from "react-dom";
import type { InputHTMLAttributes, ReactNode } from "react";
import { buttonClass, inputClass } from "./styles";

// Small shared pieces for account forms. Real <label>s, visible errors, 44px targets.

export type FormState = {
  errors?: Record<string, string>;
  message?: string;
  success?: string;
  values?: Record<string, string>;
};

export function Field({
  label,
  name,
  error,
  hint,
  ...input
}: { label: string; name: string; error?: string; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  // useId keeps ids unique when two forms on a page share a field name.
  const id = `f-${name}-${useId()}`;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      <input id={id} name={name} className={inputClass} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ children, pendingText, className = buttonClass }: { children: ReactNode; pendingText?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? (pendingText ?? "Please wait…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.message)
    return (
      <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
        {state.message}
      </p>
    );
  if (state.success)
    return (
      <p role="status" className="rounded-xl border border-primary/30 bg-primary-soft p-3 text-sm">
        {state.success}
      </p>
    );
  return null;
}
