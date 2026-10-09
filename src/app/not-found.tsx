import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex flex-col items-start gap-4 py-10">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="text-2xl font-bold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="text-muted">The link may be broken, or the page may have been removed.</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-medium text-on-primary hover:bg-primary-hover">
          Go home
        </Link>
        <Link href="/companies" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-medium hover:bg-primary-soft">
          Browse companies
        </Link>
      </div>
    </section>
  );
}
