"use client";

import { useActionState, type ReactNode } from "react";
import type { AdminResult } from "./actions";

// Small wrapper: runs an admin action and shows its result. Optional note box.
export function AdminForm({
  action,
  children,
  noteLabel,
  noteRequired = false,
  className = "",
}: {
  action: (prev: AdminResult | null, fd: FormData) => Promise<AdminResult>;
  children: ReactNode;
  noteLabel?: string;
  noteRequired?: boolean;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={`flex flex-col gap-2 ${className}`}>
      {noteLabel && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            {noteLabel} {!noteRequired && <span className="font-normal text-muted">(optional)</span>}
          </span>
          <textarea name="note" rows={2} maxLength={1000} className="min-h-11 rounded-xl border border-border bg-card px-3 py-2" />
        </label>
      )}
      <fieldset disabled={pending} className="flex flex-wrap gap-2">
        {children}
      </fieldset>
      {state && (
        <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "" : "text-danger"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
