"use client";

import Link from "next/link";

// Never show error.message to users: it may contain internal details.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="flex flex-col items-start gap-4 py-10" role="alert">
      <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
      <p className="text-muted">Sorry about that. Please try again, or go back home.</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-medium text-on-primary hover:bg-primary-hover"
        >
          Try again
        </button>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-medium hover:bg-primary-soft">
          Go home
        </Link>
      </div>
    </section>
  );
}
