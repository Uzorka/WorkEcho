import type { ReactNode } from "react";
import { inputClass } from "./styles";

// Uncontrolled radio/checkbox/select groups for short forms. Pure (no hooks),
// so they work in server and client components. Pass the last submitted
// values as defaults so nothing is lost after a validation error.

const pill =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-border px-4 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-focus)]";

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className="text-sm text-danger">
      {error}
    </p>
  ) : null;
}

export function RadioGroup({
  legend,
  hint,
  name,
  options,
  defaultValue,
  error,
}: {
  legend: string;
  hint?: string;
  name: string;
  options: Record<string, string>;
  defaultValue?: string;
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-1 font-medium">{legend}</legend>
      {hint && <p className="-mt-1 text-sm text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {Object.entries(options).map(([value, label]) => (
          <label key={value} className={pill}>
            <input type="radio" name={name} value={value} defaultChecked={defaultValue === value} className="sr-only" />
            {label}
          </label>
        ))}
      </div>
      <FieldError id={`${name}-error`} error={error} />
    </fieldset>
  );
}

export function CheckboxGroup({
  legend,
  hint,
  name,
  options,
  defaultValues = [],
  error,
}: {
  legend: string;
  hint?: string;
  name: string;
  options: Record<string, string>;
  defaultValues?: string[];
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-1 font-medium">{legend}</legend>
      {hint && <p className="-mt-1 text-sm text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {Object.entries(options).map(([value, label]) => (
          <label key={value} className={pill}>
            <input type="checkbox" name={name} value={value} defaultChecked={defaultValues.includes(value)} className="h-4 w-4 accent-primary" />
            {label}
          </label>
        ))}
      </div>
      <FieldError id={`${name}-error`} error={error} />
    </fieldset>
  );
}

export function SelectField({
  label,
  name,
  optional,
  placeholder,
  defaultValue,
  error,
  children,
}: {
  label: string;
  name: string;
  optional?: boolean;
  placeholder: string;
  defaultValue?: string;
  error?: string;
  children: ReactNode;
}) {
  const id = `sel-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        className={inputClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <option value="" disabled={!optional}>
          {placeholder}
        </option>
        {children}
      </select>
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

export function PrivacyReminder({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary-soft p-4 text-sm">
      <p className="font-semibold">Your privacy</p>
      {children}
    </div>
  );
}
