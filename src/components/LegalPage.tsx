import type { ReactNode } from "react";
import { LEGAL_LAST_UPDATED } from "@/lib/site";

// Plain-English legal page with a clear draft banner.
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <article className="flex flex-col gap-5">
      <p role="note" className="rounded-xl border-2 border-danger bg-danger/10 p-3 text-center font-bold tracking-wide text-danger">
        DRAFT — pending legal review
      </p>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        <p className="text-muted">{intro}</p>
        <p className="text-sm text-muted">Last updated: {LEGAL_LAST_UPDATED}</p>
      </header>
      <div className="legal flex flex-col gap-4 [&_h2]:mt-2 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:font-medium [&_a]:text-primary [&_a]:underline">
        {children}
      </div>
    </article>
  );
}
