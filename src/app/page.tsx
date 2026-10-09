import Link from "next/link";

export default function HomePage() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Know the company before you accept the offer
        </h1>
        <p className="text-muted">
          WorkEcho helps Nigerian job seekers learn what a company is really like — pay, interviews,
          and whether salary comes on time — from people who worked there.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold">We&apos;re still building</h2>
        <p className="mt-1 text-sm text-muted">
          The feed of workplace conversations will appear here soon. For now, explore what&apos;s
          coming.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/companies"
            className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 font-medium text-on-primary hover:bg-primary-hover"
          >
            Browse companies
          </Link>
          <Link
            href="/guidelines"
            className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 font-medium hover:bg-primary-soft"
          >
            Read the guidelines
          </Link>
        </div>
      </div>

      <p className="text-sm text-muted">
        We protect your identity, but what you write can still reveal you.
      </p>
    </section>
  );
}
