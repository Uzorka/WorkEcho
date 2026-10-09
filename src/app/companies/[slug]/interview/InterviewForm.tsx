"use client";

import { useActionState, useState } from "react";
import { CheckboxGroup, PrivacyReminder, RadioGroup, SelectField } from "@/components/ChoiceFields";
import { Field, FormMessage, SubmitButton } from "@/components/forms";
import { SensitiveWarning } from "@/components/SensitiveWarning";
import { buttonClass, inputClass } from "@/components/styles";
import { DEPARTMENTS, INTERVIEW_EXPERIENCES, INTERVIEW_LIMITS, INTERVIEW_OUTCOMES, INTERVIEW_STAGES } from "@/lib/companies";
import type { ReportFormState } from "../../actions";

export type InterviewValues = Record<string, string | string[]>;

function TextArea({ label, name, defaultValue, error, max, hint }: { label: string; name: string; defaultValue?: string; error?: string; max: number; hint?: string }) {
  const id = `ta-${name}`;
  const [text, setText] = useState(defaultValue ?? "");
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
      <textarea
        id={id}
        name={name}
        rows={5}
        maxLength={max}
        defaultValue={defaultValue}
        onChange={(e) => setText(e.target.value)}
        className={`${inputClass} min-h-32 py-2`}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint ? `${id}-hint` : "", error ? `${id}-error` : ""].join(" ").trim() || undefined}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
      <SensitiveWarning text={text} />
    </div>
  );
}

export function InterviewForm({
  initial,
  editing,
  action,
}: {
  initial: InterviewValues;
  editing: boolean;
  action: (prev: ReportFormState, formData: FormData) => Promise<ReportFormState>;
}) {
  const [state, formAction] = useActionState(action, {} as ReportFormState);
  const v = { ...initial, ...(state.values as InterviewValues | undefined) };
  const str = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : undefined);
  const e = state.errors ?? {};

  return (
    // key: remount with the submitted values after an error. React's form reset
    // would otherwise put <select>s back to their first default.
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-5" noValidate>
      <FormMessage state={{ message: state.message }} />
      <SelectField label="Area of the role" name="role_group" placeholder="Choose one" defaultValue={str("role_group")} error={e.role_group}>
        {Object.entries(DEPARTMENTS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </SelectField>
      <RadioGroup legend="How did it end?" name="outcome" options={INTERVIEW_OUTCOMES} defaultValue={str("outcome")} error={e.outcome} />
      <RadioGroup
        legend="How difficult was it?"
        hint="1 is very easy, 5 is very hard."
        name="difficulty"
        options={{ 1: "1", 2: "2", 3: "3", 4: "4", 5: "5" }}
        defaultValue={str("difficulty")}
        error={e.difficulty}
      />
      <Field
        label="How many weeks did the process take? (optional)"
        name="process_weeks"
        type="number"
        inputMode="numeric"
        min={0}
        max={INTERVIEW_LIMITS.weeks.max}
        defaultValue={str("process_weeks")}
        error={e.process_weeks}
      />
      <CheckboxGroup
        legend="Which stages were there?"
        hint="Tick all that apply."
        name="stages"
        options={INTERVIEW_STAGES}
        defaultValues={Array.isArray(v.stages) ? v.stages : []}
        error={e.stages}
      />
      <TextArea
        label="What did they ask?"
        name="questions_asked"
        hint="The kinds of questions or tests. Don't name the interviewers."
        defaultValue={str("questions_asked")}
        error={e.questions_asked}
        max={INTERVIEW_LIMITS.questions.max}
      />
      <TextArea label="Tips for others (optional)" name="tips" defaultValue={str("tips")} error={e.tips} max={INTERVIEW_LIMITS.tips.max} />
      <RadioGroup legend="Overall experience" name="experience" options={INTERVIEW_EXPERIENCES} defaultValue={str("experience")} error={e.experience} />
      <PrivacyReminder>
        <p>We protect your identity, but what you write can still reveal you. Leave out dates, names and details only a few candidates would know.</p>
        <p>Your name and pseudonym are never shown on interview reports. {editing ? "" : "It appears within 72 hours, after a random delay."}</p>
      </PrivacyReminder>
      <SubmitButton className={buttonClass} pendingText="Saving…">
        {editing ? "Save changes" : "Share my interview"}
      </SubmitButton>
    </form>
  );
}
