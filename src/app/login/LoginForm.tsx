"use client";

import Link from "next/link";
import { useActionState } from "react";
import { logIn } from "@/app/auth/actions";
import { Field, FormMessage, SubmitButton, type FormState } from "@/components/forms";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(logIn, {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      {next && <input type="hidden" name="next" value={next} />}
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        error={state.errors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.errors?.password}
      />
      <Link href="/forgot-password" className="-mt-1 self-start py-2 text-sm font-medium text-primary underline">
        Forgot your password?
      </Link>
      <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
    </form>
  );
}
