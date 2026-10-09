"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { reportContent } from "@/app/reports/actions";
import { REPORT_REASONS, type ReportContentType, type ReportReason } from "@/lib/report-reasons";
import { buttonClass, inputClass, secondaryButtonClass } from "./styles";

const small = "inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-medium text-muted hover:bg-primary-soft hover:text-text";

// "Report" on any post, reply, review, interview or salary row. Opens a short
// inline form. Reporters are never shown to anyone except admins.
export function ReportButton({
  type,
  id,
  signedIn,
  loginNext,
  roleGroup,
  level,
}: {
  type: ReportContentType;
  id: string;
  signedIn: boolean;
  loginNext: string;
  roleGroup?: string;
  level?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const uid = useId();

  if (!signedIn)
    return (
      <Link href={`/login?next=${encodeURIComponent(loginNext)}`} className={small}>
        Report
      </Link>
    );

  if (result?.ok)
    return (
      <p role="status" className="w-full py-2 text-sm">
        {result.message}
      </p>
    );

  if (!open)
    return (
      <button type="button" className={small} onClick={() => setOpen(true)} aria-expanded={false}>
        Report
      </button>
    );

  function submit() {
    if (!reason) {
      setResult({ ok: false, message: "Choose a reason." });
      return;
    }
    startTransition(async () => {
      try {
        setResult(await reportContent({ type, id, reason, details: details || undefined, roleGroup, level }));
      } catch {
        setResult({ ok: false, message: "We couldn't send your report. Please try again." });
      }
    });
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-border bg-surface p-3">
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 font-medium">What&apos;s wrong?</legend>
        {(Object.keys(REPORT_REASONS) as ReportReason[]).map((r) => (
          <label key={r} className="flex min-h-11 items-center gap-3">
            <input type="radio" name={`${uid}-reason`} value={r} checked={reason === r} onChange={() => setReason(r)} className="h-5 w-5 accent-primary" />
            {REPORT_REASONS[r]}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-details`} className="text-sm font-medium">
          More details <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id={`${uid}-details`} rows={2} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} className={`${inputClass} py-2`} />
      </div>
      {result && !result.ok && (
        <p role="alert" className="text-sm text-danger">
          {result.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={submit} disabled={pending} className={buttonClass}>
          {pending ? "Sending…" : "Send report"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
    </div>
  );
}
