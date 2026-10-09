"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/app/auth/actions";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/forms";
import { MIN_PASSWORD_LENGTH } from "@/lib/account-constants";

export function SignupForm() {
  const [state, action] = useActionState(signUp, {} as FormState);
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
        hint="Use a personal email, not your work email."
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        error={state.errors?.password}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
      />
      <div className="flex flex-col gap-1.5">
        <label className="flex min-h-11 items-start gap-3">
          <input
            type="checkbox"
            name="agree"
            required
            className="mt-1 h-5 w-5 shrink-0 accent-primary"
            aria-invalid={state.errors?.agree ? true : undefined}
            aria-describedby={state.errors?.agree ? "agree-error" : undefined}
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="font-medium text-primary underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-medium text-primary underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {state.errors?.agree && (
          <p id="agree-error" className="text-sm text-danger">
            {state.errors.agree}
          </p>
        )}
      </div>
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
