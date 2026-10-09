"use client";

import { useActionState } from "react";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/forms";
import { dangerButtonClass } from "@/components/styles";
import { deleteAccount } from "./actions";

export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccount, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        label="Type DELETE to confirm"
        name="confirm"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        required
        error={state.errors?.confirm}
      />
      <SubmitButton className={dangerButtonClass} pendingText="Deleting…">
        Delete my account
      </SubmitButton>
    </form>
  );
}
