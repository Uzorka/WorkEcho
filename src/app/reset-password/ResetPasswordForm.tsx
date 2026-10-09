"use client";

import { useActionState } from "react";
import { resetPassword } from "@/app/auth/actions";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/forms";
import { MIN_PASSWORD_LENGTH } from "@/lib/account-constants";

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPassword, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
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
      <Field label="Type it again" name="confirm" type="password" autoComplete="new-password" required error={state.errors?.confirm} />
      <SubmitButton pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}
