"use client";

import { useActionState } from "react";
import { CheckboxGroup, PrivacyReminder, RadioGroup, SelectField } from "@/components/ChoiceFields";
import { Field, FormMessage, SubmitButton } from "@/components/forms";
import { buttonClass } from "@/components/styles";
import { BENEFITS, DEPARTMENTS, EMPLOYMENT_TYPES, SALARY_LEVELS } from "@/lib/companies";
import { NIGERIAN_STATES, stateLabel } from "@/lib/nigeria";
import type { ReportFormState } from "../../actions";

export type SalaryValues = Record<string, string | string[]>;

export function SalaryForm({
  initial,
  editing,
  action,
}: {
  initial: SalaryValues;
  editing: boolean;
  action: (prev: ReportFormState, formData: FormData) => Promise<ReportFormState>;
}) {
  const [state, formAction] = useActionState(action, {} as ReportFormState);
  const v = { ...initial, ...(state.values as SalaryValues | undefined) };
  const str = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : undefined);
  const e = state.errors ?? {};

  return (
    // key: remount with the submitted values after an error. React's form reset
    // would otherwise put <select>s back to their first default.
    <form key={JSON.stringify(v)} action={formAction} className="flex flex-col gap-5" noValidate>
      <FormMessage state={{ message: state.message }} />
      <SelectField label="Area you work in" name="role_group" placeholder="Choose one" defaultValue={str("role_group")} error={e.role_group}>
        {Object.entries(DEPARTMENTS).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </SelectField>
      <RadioGroup legend="Your level" name="level" options={SALARY_LEVELS} defaultValue={str("level")} error={e.level} />
      <RadioGroup legend="Employment type" name="employment_type" options={EMPLOYMENT_TYPES} defaultValue={str("employment_type")} error={e.employment_type} />
      <SelectField label="State" name="state" optional placeholder="Prefer not to say" defaultValue={str("state")} error={e.state}>
        {NIGERIAN_STATES.map((s) => (
          <option key={s} value={s}>
            {stateLabel(s)}
          </option>
        ))}
      </SelectField>
      <Field
        label="Monthly gross pay (₦)"
        name="monthly_gross_naira"
        inputMode="numeric"
        autoComplete="off"
        placeholder="e.g. 250,000"
        hint="Before tax and deductions, per month."
        defaultValue={str("monthly_gross_naira")}
        error={e.monthly_gross_naira}
      />
      <RadioGroup legend="Do you get a bonus?" name="has_bonus" options={{ yes: "Yes", no: "No" }} defaultValue={str("has_bonus")} error={e.has_bonus} />
      <CheckboxGroup
        legend="Other benefits"
        hint="Tick all that apply."
        name="other_benefits"
        options={{ ...BENEFITS, none: "None of these" }}
        defaultValues={Array.isArray(v.other_benefits) ? v.other_benefits : []}
        error={e.other_benefits}
      />
      <PrivacyReminder>
        <p>Your exact salary is never shown to anyone. We only show a range once 3 people report the same role and level, rounded to the nearest ₦10,000.</p>
        <p>{editing ? "Changes show up straight away for reports that are already live." : "Your report counts within 72 hours. We add a random delay so the timing can't point to you."}</p>
      </PrivacyReminder>
      <SubmitButton className={buttonClass} pendingText="Saving…">
        {editing ? "Save changes" : "Add my salary"}
      </SubmitButton>
    </form>
  );
}
