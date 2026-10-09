"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/auth/actions";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/forms";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.errors?.email}
      />
      <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}
