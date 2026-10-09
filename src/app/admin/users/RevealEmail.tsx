"use client";

import { useState, useTransition } from "react";
import { secondaryButtonClass } from "@/components/styles";
import { revealBannedEmail } from "../actions";

// Banned accounts only, to enforce the ban (e.g. block a new sign-up). Every reveal is logged.
export function RevealEmail({ userId }: { userId: string }) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  if (result?.ok) return <p className="text-sm">Email: {result.message}</p>;
  return (
    <div className="flex flex-col gap-1">
      <button type="button" disabled={pending} className={`${secondaryButtonClass} self-start`} onClick={() => startTransition(async () => setResult(await revealBannedEmail(userId)))}>
        Show email to enforce ban (logged)
      </button>
      {result && <p className="text-sm text-danger">{result.message}</p>}
    </div>
  );
}
