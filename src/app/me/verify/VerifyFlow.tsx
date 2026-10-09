"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, SubmitButton } from "@/components/forms";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/styles";
import { confirmVerificationCode, sendVerificationCode, type VerifyState } from "./actions";

type Company = { id: string; name: string; email_domains: string[] };

export function VerifyFlow({ companies, initialCompanyId }: { companies: Company[]; initialCompanyId?: string }) {
  const [state, setState] = useState<VerifyState>({ step: "email", companyId: initialCompanyId });
  if (state.step === "code") return <CodeStep initial={state} onRestart={() => setState({ step: "email" })} />;
  return <EmailStep companies={companies} initial={state} onSent={setState} />;
}

function Alert({ text }: { text?: string }) {
  return text ? (
    <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
      {text}
    </p>
  ) : null;
}

function EmailStep({ companies, initial, onSent }: { companies: Company[]; initial: VerifyState; onSent: (s: VerifyState) => void }) {
  const [state, action] = useActionState(async (prev: VerifyState, fd: FormData) => {
    const next = await sendVerificationCode(prev, fd);
    if (next.step === "code") onSent(next);
    return next;
  }, initial);
  const [companyId, setCompanyId] = useState(initial.step === "email" ? (initial.companyId ?? "") : "");
  const company = companies.find((c) => c.id === companyId);
  const errors = state.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <Alert text={state.message} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="verify-company" className="font-medium">
          Company
        </label>
        <select
          id="verify-company"
          name="company_id"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
          className={inputClass}
          aria-invalid={errors.company_id ? true : undefined}
        >
          <option value="" disabled>
            Choose your company
          </option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.company_id && <p className="text-sm text-danger">{errors.company_id}</p>}
        <p className="text-sm text-muted">
          Only companies with known work-email domains are listed. Missing yours?{" "}
          <Link href="/companies" className="text-primary underline">
            Find it on Companies
          </Link>{" "}
          and let us know.
        </p>
      </div>
      <Field
        label="Work email"
        name="email"
        type="email"
        autoComplete="off"
        inputMode="email"
        placeholder={company ? `you@${company.email_domains[0]}` : "you@yourcompany.com"}
        error={errors.email}
        hint="We only use it to send you a code. We never save it."
      />
      <div className="flex flex-col gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
        <label className="flex min-h-11 items-start gap-3">
          <input type="checkbox" name="consent" className="mt-1 h-5 w-5 shrink-0 accent-primary" aria-invalid={errors.consent ? true : undefined} />
          <span>
            Your company&apos;s email system may record that WorkEcho sent you an email. Only continue if you&apos;re comfortable with that.
          </span>
        </label>
        {errors.consent && <p className="text-sm text-danger">{errors.consent}</p>}
      </div>
      <SubmitButton className={buttonClass} pendingText="Sending…">
        Send my code
      </SubmitButton>
    </form>
  );
}

function CodeStep({ initial, onRestart }: { initial: Extract<VerifyState, { step: "code" }>; onRestart: () => void }) {
  const [state, action] = useActionState(confirmVerificationCode, initial as VerifyState);
  const s = state.step === "code" ? state : initial;
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      <p role="status">
        We sent a 6-digit code to <strong>{s.masked}</strong> for <strong>{s.companyName}</strong>. It expires in 15 minutes.
      </p>
      <Alert text={s.message} />
      <Field
        label="Verification code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        pattern="[0-9]{6}"
        error={s.errors?.code}
      />
      <div className="flex flex-wrap gap-3">
        <SubmitButton className={buttonClass} pendingText="Checking…">
          Verify
        </SubmitButton>
        <button type="button" onClick={onRestart} className={secondaryButtonClass}>
          Start again
        </button>
      </div>
    </form>
  );
}
