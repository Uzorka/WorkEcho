"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton, type FormState } from "@/components/forms";
import { inputClass } from "@/components/styles";
import { USER_TYPES, USER_TYPE_LABELS, type UserType } from "@/lib/account-constants";
import { NIGERIAN_STATES, stateLabel } from "@/lib/nigeria";
import { saveAboutYou } from "./actions";

const HINTS: Record<UserType, string> = {
  current_employee: "You work at a company you might write about.",
  former_employee: "You used to work at a company you might write about.",
  job_seeker: "You're looking for work and want to learn about companies.",
};

export function AboutYouForm({ userType, state: savedState }: { userType: UserType | null; state: string | null }) {
  const [state, action] = useActionState(saveAboutYou, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <FormMessage state={state} />
      <fieldset className="flex flex-col gap-2" aria-describedby={state.errors?.user_type ? "user_type-error" : undefined}>
        <legend className="mb-1 font-medium">Which best describes you?</legend>
        {USER_TYPES.map((t) => (
          <label
            key={t}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
          >
            <input type="radio" name="user_type" value={t} defaultChecked={userType === t} required className="mt-1 h-5 w-5 shrink-0 accent-primary" />
            <span>
              <span className="block font-medium">{USER_TYPE_LABELS[t]}</span>
              <span className="block text-sm text-muted">{HINTS[t]}</span>
            </span>
          </label>
        ))}
        {state.errors?.user_type && (
          <p id="user_type-error" className="text-sm text-danger">
            {state.errors.user_type}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="f-state" className="font-medium">
          State <span className="font-normal text-muted">(optional)</span>
        </label>
        <p id="f-state-hint" className="text-sm text-muted">
          Where you live or work. You can skip this.
        </p>
        <select id="f-state" name="state" defaultValue={savedState ?? ""} className={inputClass} aria-describedby="f-state-hint">
          <option value="">Prefer not to say</option>
          {NIGERIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {stateLabel(s)}
            </option>
          ))}
        </select>
        {state.errors?.state && <p className="text-sm text-danger">{state.errors.state}</p>}
      </div>

      <SubmitButton pendingText="Saving…">Continue</SubmitButton>
    </form>
  );
}
