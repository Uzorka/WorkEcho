"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms";
import { dangerButtonClass } from "@/components/styles";
import type { ReviewFormState } from "../../actions";

export function DeleteReviewForm({ action }: { action: (prev: ReviewFormState, formData: FormData) => Promise<ReviewFormState> }) {
  const [state, formAction] = useActionState(action, {} as ReviewFormState);
  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {state.message && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" name="confirm" className="mt-1 h-5 w-5 shrink-0 accent-primary" />
        <span>Yes, delete my review. This can&apos;t be undone.</span>
      </label>
      {state.errors?.confirm && <p className="text-sm text-danger">{state.errors.confirm}</p>}
      <SubmitButton className={`${dangerButtonClass} self-start`} pendingText="Deleting…">
        Delete my review
      </SubmitButton>
    </form>
  );
}
