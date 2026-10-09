"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { SubmitButton } from "@/components/forms";
import { ReviewCard } from "@/components/ReviewCard";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/styles";
import {
  DEPARTMENTS,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  NIGERIA_QUESTIONS,
  PROBATION_OUTCOMES,
  RATING_CATEGORIES,
  REVIEW_LIMITS,
  YES_NO_SOMETIMES,
} from "@/lib/companies";
import { NIGERIAN_STATES, stateLabel } from "@/lib/nigeria";
import { reviewDraftKey } from "@/lib/review-draft";
import { validateReviewStep, REVIEW_STEP_FIELDS, type ReviewValues } from "@/lib/review-steps";
import type { ReviewFormState } from "../../actions";

const STEPS = ["About your job", "Ratings", "Pay and benefits", "Write it"];

function currentQuarter() {
  const d = new Date();
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}

export function ReviewForm({
  slug,
  companyName,
  initial,
  editing,
  action,
}: {
  slug: string;
  companyName: string;
  initial: ReviewValues;
  editing: boolean;
  action: (prev: ReviewFormState, formData: FormData) => Promise<ReviewFormState>;
}) {
  const [state, formAction] = useActionState(action, {} as ReviewFormState);
  const [values, setValues] = useState<ReviewValues>(initial);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [restored, setRestored] = useState(false);
  const loaded = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Load a saved draft (new reviews only).
  useEffect(() => {
    if (!editing) {
      try {
        const saved = localStorage.getItem(reviewDraftKey(slug));
        if (saved) {
          setValues((v) => ({ ...v, ...(JSON.parse(saved) as ReviewValues) }));
          setRestored(true);
        }
      } catch {}
    }
    loaded.current = true;
  }, [editing, slug]);

  // Save the draft on this device as the user types.
  useEffect(() => {
    if (editing || !loaded.current) return;
    try {
      localStorage.setItem(reviewDraftKey(slug), JSON.stringify(values));
    } catch {}
  }, [values, editing, slug]);

  // Server-side errors: jump to the first step that has one.
  useEffect(() => {
    if (!state.errors) return;
    setErrors(state.errors);
    const bad = REVIEW_STEP_FIELDS.findIndex((fields) => fields.some((f) => state.errors?.[f]));
    if (bad >= 0) setStep(bad + 1);
  }, [state]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [step]);

  const set = (name: string, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: "" } : e));
  };

  function next() {
    const errs = validateReviewStep(step, values);
    setErrors(errs);
    if (Object.keys(errs).length === 0) setStep((s) => Math.min(s + 1, STEPS.length));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    // Enter key on an early step moves forward instead of submitting.
    if (step < STEPS.length) {
      e.preventDefault();
      next();
      return;
    }
    for (let s = 1; s <= STEPS.length; s++) {
      const errs = validateReviewStep(s, values);
      if (Object.keys(errs).length) {
        e.preventDefault();
        setErrors(errs);
        setStep(s);
        return;
      }
    }
  }

  function startOver() {
    try {
      localStorage.removeItem(reviewDraftKey(slug));
    } catch {}
    setValues(initial);
    setErrors({});
    setRestored(false);
    setStep(1);
  }

  const preview = {
    ...values,
    department: values.department || null,
    state: values.state || null,
    rating_overall: Number(values.rating_overall) || 0,
    salary_on_time: values.salary_on_time || null,
    overtime_paid: values.overtime_paid || null,
    has_hmo: values.has_hmo || null,
    pension_remitted: values.pension_remitted || null,
    got_contract: values.got_contract || null,
    probation_months: values.probation_months === "" ? null : Number(values.probation_months),
    confirmed_after_probation: values.confirmed_after_probation || null,
    advice_to_management: values.advice_to_management.trim() || null,
    headline: values.headline.trim() || "Your headline",
    pros: values.pros.trim() || "…",
    cons: values.cons.trim() || "…",
    published_quarter: currentQuarter(),
  };

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted">
          Step {step} of {STEPS.length}: {STEPS[step - 1]}
        </p>
        <div role="progressbar" aria-label="Review progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step} className="flex gap-2">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>
      </div>

      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold tracking-tight break-words focus:outline-none">
        {editing ? "Edit your review of" : "Review"} {companyName}
      </h1>

      {restored && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary-soft p-3 text-sm">
          <span>We restored the draft saved on this device.</span>
          <button type="button" onClick={startOver} className="min-h-11 font-medium text-primary underline">
            Start over
          </button>
        </div>
      )}
      {state.message && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {state.message}
        </p>
      )}

      {/* All steps stay in the form (hidden ones too) so one submit sends everything. */}
      <div hidden={step !== 1} className="flex flex-col gap-5">
        <Choice
          legend="Do you work there now?"
          name="employment_status"
          options={EMPLOYMENT_STATUSES}
          value={values.employment_status}
          onChange={set}
          error={errors.employment_status}
        />
        <Choice
          legend="Employment type"
          name="employment_type"
          options={EMPLOYMENT_TYPES}
          value={values.employment_type}
          onChange={set}
          error={errors.employment_type}
        />
        <Select label="Department" optional name="department" value={values.department} onChange={set} placeholder="Prefer not to say">
          {Object.entries(DEPARTMENTS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          label="State where you worked"
          optional
          hint="Shown on your review. Leave it out if it would make you easy to spot."
          name="state"
          value={values.state}
          onChange={set}
          placeholder="Prefer not to say"
        >
          {NIGERIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {stateLabel(s)}
            </option>
          ))}
        </Select>
      </div>

      <div hidden={step !== 2} className="flex flex-col gap-5">
        <p className="text-muted">1 is very poor, 5 is excellent.</p>
        {RATING_CATEGORIES.map((c) => (
          <Rating key={c.key} label={c.label} name={c.key} value={values[c.key]} onChange={set} error={errors[c.key]} />
        ))}
      </div>

      <div hidden={step !== 3} className="flex flex-col gap-5">
        <p className="text-muted">Answer what you know. Pick &ldquo;Not sure&rdquo; for anything you don&apos;t.</p>
        {NIGERIA_QUESTIONS.map((q) => (
          <Choice
            key={q.key}
            legend={q.question}
            name={q.key}
            options={{ ...YES_NO_SOMETIMES, "": "Not sure" }}
            value={values[q.key]}
            onChange={set}
          />
        ))}
        <Select label="How long was probation?" optional name="probation_months" value={values.probation_months} onChange={set} placeholder="Not sure / skip">
          {Array.from({ length: 13 }, (_, i) => (
            <option key={i} value={String(i)}>
              {i === 0 ? "No probation" : `${i} ${i === 1 ? "month" : "months"}`}
            </option>
          ))}
        </Select>
        <Select
          label="Were you confirmed after probation?"
          optional
          name="confirmed_after_probation"
          value={values.confirmed_after_probation}
          onChange={set}
          placeholder="Not sure / skip"
        >
          {Object.entries(PROBATION_OUTCOMES).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      <div hidden={step !== 4} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary-soft p-4 text-sm">
          <p className="font-semibold">Before you write</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>We protect your identity, but what you write can still reveal you. Avoid details only a few people know.</li>
            <li>Review the company, not named individuals.</li>
            <li>No crime accusations you can&apos;t prove, no confidential documents, no phone numbers or emails.</li>
          </ul>
        </div>
        <Text label="Headline" name="headline" value={values.headline} onChange={set} error={errors.headline} max={REVIEW_LIMITS.headline.max} placeholder="Sum it up in a few words" />
        <Text label="Pros" name="pros" multiline value={values.pros} onChange={set} error={errors.pros} max={REVIEW_LIMITS.pros.max} min={REVIEW_LIMITS.pros.min} placeholder="What's good about working here?" />
        <Text label="Cons" name="cons" multiline value={values.cons} onChange={set} error={errors.cons} max={REVIEW_LIMITS.cons.max} min={REVIEW_LIMITS.cons.min} placeholder="What could be better?" />
        <Text
          label="Advice to management (optional)"
          name="advice_to_management"
          multiline
          value={values.advice_to_management}
          onChange={set}
          error={errors.advice_to_management}
          max={REVIEW_LIMITS.advice.max}
        />
        <section aria-labelledby="preview-heading" className="flex flex-col gap-2">
          <h2 id="preview-heading" className="text-lg font-semibold">
            Preview
          </h2>
          <p className="text-sm text-muted">This is how readers will see it. Your pseudonym is never shown on reviews.</p>
          <ReviewCard review={preview} />
        </section>
        {!editing && <p className="text-sm text-muted">Your review will appear within 72 hours. Your draft is saved on this device until you submit.</p>}
      </div>

      <div className="flex flex-wrap gap-3">
        {step > 1 && (
          <button type="button" onClick={() => setStep((s) => s - 1)} className={secondaryButtonClass}>
            ← Back
          </button>
        )}
        {step < STEPS.length ? (
          <button type="button" onClick={next} className={`${buttonClass} flex-1`}>
            Continue
          </button>
        ) : (
          <SubmitButton className={`${buttonClass} flex-1`} pendingText="Submitting…">
            {editing ? "Save changes" : "Submit review"}
          </SubmitButton>
        )}
      </div>
    </form>
  );
}

function ErrorText({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className="text-sm text-danger">
      {error}
    </p>
  ) : null;
}

function Choice({
  legend,
  name,
  options,
  value,
  onChange,
  error,
}: {
  legend: string;
  name: string;
  options: Record<string, string>;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-1 font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {Object.entries(options).map(([k, label]) => (
          <label
            key={k}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-border px-4 has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-focus)]"
          >
            <input type="radio" name={name} value={k} checked={value === k} onChange={() => onChange(name, k)} className="sr-only" />
            {label}
          </label>
        ))}
      </div>
      <ErrorText id={`${name}-error`} error={error} />
    </fieldset>
  );
}

function Rating({ label, name, value, onChange, error }: { label: string; name: string; value: string; onChange: (n: string, v: string) => void; error?: string }) {
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="mb-1 font-medium">{label}</legend>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-border font-semibold has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--color-focus)]"
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === String(n)}
              onChange={() => onChange(name, String(n))}
              className="sr-only"
              aria-label={`${label}: ${n} out of 5`}
            />
            <span aria-hidden>{n}</span>
          </label>
        ))}
      </div>
      <ErrorText id={`${name}-error`} error={error} />
    </fieldset>
  );
}

function Select({
  label,
  optional,
  hint,
  name,
  value,
  onChange,
  placeholder,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  name: string;
  value: string;
  onChange: (n: string, v: string) => void;
  placeholder: string;
  children: ReactNode;
}) {
  const id = `rv-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      <select id={id} name={name} value={value} onChange={(e) => onChange(name, e.target.value)} className={inputClass} aria-describedby={hint ? `${id}-hint` : undefined}>
        <option value="">{placeholder}</option>
        {children}
      </select>
    </div>
  );
}

function Text({
  label,
  name,
  value,
  onChange,
  error,
  max,
  min,
  multiline,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (n: string, v: string) => void;
  error?: string;
  max: number;
  min?: number;
  multiline?: boolean;
  placeholder?: string;
}) {
  const id = `rv-${name}`;
  const len = value.trim().length;
  const props = {
    id,
    name,
    value,
    maxLength: max,
    placeholder,
    onChange: (e: { target: { value: string } }) => onChange(name, e.target.value),
    className: `${inputClass} ${multiline ? "min-h-32 py-2" : ""}`,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": `${id}-count${error ? ` ${id}-error` : ""}`,
  };
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {multiline ? <textarea rows={5} {...props} /> : <input {...props} />}
      <p id={`${id}-count`} className="text-xs text-muted">
        {min && len < min ? `${len} / at least ${min} characters` : `${len} / ${max}`}
      </p>
      <ErrorText id={`${id}-error`} error={error} />
    </div>
  );
}
