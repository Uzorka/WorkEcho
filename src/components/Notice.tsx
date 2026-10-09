import type { ReactNode } from "react";

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-xl border border-primary/30 bg-primary-soft p-3 text-sm">
      {children}
    </p>
  );
}
