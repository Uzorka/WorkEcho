import Link from "next/link";
import type { ReactNode } from "react";

// Honest placeholder for pages that are built in a later slice.
export function Placeholder({
  title,
  intro,
  comingIn,
  children,
}: {
  title: string;
  intro: string;
  comingIn: string;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
      <p className="text-muted">{intro}</p>
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="font-medium">This page isn&apos;t ready yet.</p>
        <p className="mt-1 text-sm text-muted">It&apos;s being built in {comingIn}.</p>
        {children}
        <Link
          href="/"
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-medium text-on-primary hover:bg-primary-hover"
        >
          Back to home
        </Link>
      </div>
    </section>
  );
}
