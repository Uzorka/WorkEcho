"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Field, SubmitButton } from "@/components/forms";
import { inputClass } from "@/components/styles";
import { INDUSTRIES } from "@/lib/companies";
import { NIGERIAN_STATES, stateLabel } from "@/lib/nigeria";
import { requestCompany, type RequestFormState } from "./actions";

export function RequestCompanyForm({ initialName }: { initialName: string }) {
  const [state, action] = useActionState(requestCompany, {} as RequestFormState);

  if (state.success)
    return (
      <p role="status" className="rounded-xl border border-primary/30 bg-primary-soft p-3 text-sm">
        {state.success}
      </p>
    );

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm">
          <p className="text-danger">{state.message}</p>
          {state.matches && (
            <ul className="flex flex-col gap-1">
              {state.matches.map((m) => (
                <li key={m.slug}>
                  <Link href={`/companies/${m.slug}`} className="font-medium text-primary underline">
                    {m.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <Field label="Company name" name="name" required defaultValue={initialName} error={state.errors?.name} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="req-industry" className="font-medium">
          Industry
        </label>
        <select id="req-industry" name="industry" required defaultValue="" className={inputClass} aria-invalid={state.errors?.industry ? true : undefined}>
          <option value="" disabled>
            Choose an industry
          </option>
          {INDUSTRIES.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
        {state.errors?.industry && <p className="text-sm text-danger">{state.errors.industry}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="req-state" className="font-medium">
          State <span className="font-normal text-muted">(optional)</span>
        </label>
        <select id="req-state" name="state" defaultValue="" className={inputClass}>
          <option value="">Not sure / many states</option>
          {NIGERIAN_STATES.map((s) => (
            <option key={s} value={s}>
              {stateLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <Field
        label="Website (optional)"
        name="website"
        type="url"
        inputMode="url"
        placeholder="example.com"
        error={state.errors?.website}
      />
      <SubmitButton pendingText="Sending…">Request this company</SubmitButton>
    </form>
  );
}
