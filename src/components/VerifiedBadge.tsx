"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { CheckIcon } from "./CheckIcon";

// Checkmark next to a pseudonym. Tapping it opens a small explanation sheet.
// It never says which company the person verified with.
export function VerifiedBadge({ size = 18 }: { size?: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        aria-label="Verified worker. What does this mean?"
        className="-m-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-primary"
      >
        <CheckIcon size={size} />
      </button>
      {open && (
        <span
          id={id}
          role="dialog"
          aria-label="Verified worker"
          className="absolute top-full left-1/2 z-30 mt-1 flex w-64 -translate-x-1/2 flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-left text-sm font-normal text-text shadow-lg"
        >
          <span className="flex items-center gap-2 font-semibold">
            <CheckIcon size={18} /> Verified worker
          </span>
          <span>
            This person confirmed they work or worked at a company on WorkEcho. Checkmarks are earned through verification and can never be
            bought.
          </span>
          <Link href="/verification" className="font-medium text-primary underline">
            How checkmarks work
          </Link>
        </span>
      )}
    </span>
  );
}
