"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/forms";
import { MIN_PASSWORD_LENGTH } from "@/lib/account-constants";
import { changePassword } from "./actions";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePassword, {} as FormState);
  return (
    // key resets the inputs after a successful change
    <form key={state.success ?? "form"} action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field label="Current password" name="current" type="password" autoComplete="current-password" required error={state.errors?.current} />
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        error={state.errors?.password}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      />
      <Field label="Type the new password again" name="confirm" type="password" autoComplete="new-password" required error={state.errors?.confirm} />
      <SubmitButton pendingText="Saving…">Change password</SubmitButton>
    </form>
  );
}
