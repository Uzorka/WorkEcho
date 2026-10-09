import type { ReactNode } from "react";

export function AuthCard({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      {intro && <div className="text-muted">{intro}</div>}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">{children}</div>
    </section>
  );
}
