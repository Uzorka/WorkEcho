import type { Metadata } from "next";
import Link from "next/link";
import { BannedNotice } from "@/components/BannedNotice";
import { getMyProfile, requireUser } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/mailer";
import { createClient } from "@/lib/supabase/server";
import { VerifyFlow } from "./VerifyFlow";

export const metadata: Metadata = { title: "Get verified" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  await requireUser("/me/verify");
  const { company: slug } = await searchParams;
  const profile = await getMyProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("id, name, slug, email_domains").neq("email_domains", "{}").order("name");
  const companies = (data ?? []) as { id: string; name: string; slug: string; email_domains: string[] }[];
  const preselected = companies.find((c) => c.slug === slug)?.id;

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Link href="/me" className="-my-2 self-start py-2 text-sm font-medium text-primary underline">
        ← Back to Me
      </Link>
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Get verified</h1>
      <p className="text-muted">
        Prove you work or worked at a company with your work email and earn a checkmark. Your reviews and reports for that company show as
        &ldquo;Verified&rdquo; and count more. Checkmarks can never be bought.{" "}
        <Link href="/verification" className="text-primary underline">
          How it works
        </Link>
      </p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
        <li>We never save your work email. We use it once to send a code.</li>
        <li>Your checkmark never shows which company you verified with.</li>
        <li>It lasts 12 months. You can renew it in the last 30 days.</li>
      </ul>
      {profile?.is_banned ? (
        <BannedNotice />
      ) : !isEmailConfigured() ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-muted">Email verification isn&apos;t switched on yet. Please check back soon.</p>
      ) : companies.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-muted">No companies can be verified by email yet. Please check back soon.</p>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5">
          <VerifyFlow companies={companies.map(({ id, name, email_domains }) => ({ id, name, email_domains }))} initialCompanyId={preselected} />
        </div>
      )}
    </section>
  );
}
