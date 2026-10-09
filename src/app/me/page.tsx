import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { SubmitButton } from "@/components/forms";
import { BannedNotice } from "@/components/BannedNotice";
import { Notice } from "@/components/Notice";
import { secondaryButtonClass } from "@/components/styles";
import { getMyProfile, requireUser } from "@/lib/auth";
import { USER_TYPE_LABELS } from "@/lib/account-constants";
import { stateLabel } from "@/lib/nigeria";
import { createClient } from "@/lib/supabase/server";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { verificationState } from "@/lib/verification";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { DeleteAccountForm } from "./DeleteAccountForm";

export const metadata: Metadata = { title: "Me" };

const NOTICES: Record<string, string> = {
  welcome: "You're all set. Welcome to WorkEcho!",
  "password-updated": "Your new password is saved.",
  verified: "You're verified! Your checkmark now shows next to your pseudonym.",
};

export default async function MePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { notice } = await searchParams;
  await requireUser("/me");
  const profile = await getMyProfile();
  if (!profile?.onboarded_at || !profile.user_type) redirect("/onboarding");
  const supabase = await createClient();
  const isAdmin = (await supabase.rpc("is_admin")).data === true;

  // Own verifications only (RLS). Company names come from the public companies table.
  const { data: rows } = await supabase.from("verifications").select("id, company_id, verified_at, expires_at, status").order("verified_at", { ascending: false });
  const verifications = (rows ?? []) as { id: string; company_id: string; verified_at: string; expires_at: string; status: string }[];
  const { data: companyRows } = verifications.length
    ? await supabase.from("companies").select("id, name, slug").in("id", verifications.map((v) => v.company_id))
    : { data: [] as { id: string; name: string; slug: string }[] };
  const companyById = new Map((companyRows ?? []).map((c) => [c.id as string, c as { name: string; slug: string }]));
  const states = verifications.map((v) => ({ ...v, state: verificationState(v), company: companyById.get(v.company_id) }));
  const isVerified = states.some((v) => v.state === "active" || v.state === "expiring");
  const dueForRenewal = states.filter((v) => v.state === "expiring" || v.state === "expired");
  const date = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" });

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Me</h1>
      {notice && NOTICES[notice] && <Notice>{NOTICES[notice]}</Notice>}
      {profile.is_banned && <BannedNotice />}
      {dueForRenewal.map((v) => (
        <div key={v.id} role="status" className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold">
            {v.state === "expired" ? "Your verification has expired" : `Your verification expires on ${date(v.expires_at)}`}
            {v.company ? ` (${v.company.name})` : ""}.
          </p>
          <p className="mt-1">
            Renew it to keep your checkmark.{" "}
            <Link href={`/me/verify${v.company ? `?company=${v.company.slug}` : ""}`} className="font-medium text-primary underline">
              Renew now
            </Link>
          </p>
        </div>
      ))}

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted">Your pseudonym</p>
        <p className="flex flex-wrap items-center gap-2 text-2xl font-bold break-all text-primary">
          <span data-testid="pseudonym">{profile.pseudonym}</span>
          {isVerified && <VerifiedBadge size={22} />}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">You are a</dt>
          <dd>{USER_TYPE_LABELS[profile.user_type]}</dd>
          <dt className="text-muted">State</dt>
          <dd>{profile.state ? stateLabel(profile.state) : "Not shared"}</dd>
        </dl>
        <p className="text-sm text-muted">
          We protect your identity, but what you write can still reveal you.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Verification</h2>
        {states.length === 0 ? (
          <p className="text-sm text-muted">
            Verify with your work email to earn a checkmark. We never save the email, and the checkmark never shows which company.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm" aria-label="Your verifications">
            {states.map((v) => (
              <li key={v.id} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2 last:border-0">
                <span className="font-medium">{v.company?.name ?? "Company"}</span>
                <span className="text-muted">
                  {v.state === "revoked"
                    ? "Removed by moderators"
                    : v.state === "expired"
                      ? `Expired ${date(v.expires_at)}`
                      : `Verified · expires ${date(v.expires_at)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">Only you can see which company you verified with.</p>
        <Link href="/me/verify" className="self-start font-medium text-primary underline">
          {states.length ? "Verify another company" : "Get verified"}
        </Link>
      </div>

      {isAdmin && (
        <Link href="/admin" className="self-start font-medium text-primary underline">
          Open the admin area
        </Link>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Change password</h2>
        <ChangePasswordForm />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Sign out</h2>
        <form action={signOut}>
          <SubmitButton className={secondaryButtonClass} pendingText="Signing out…">
            Sign out
          </SubmitButton>
        </form>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-danger/40 bg-card p-5">
        <h2 className="text-lg font-semibold">Delete my account</h2>
        <div className="flex flex-col gap-2 text-sm">
          <p>This can&apos;t be undone. When you delete your account:</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>Your email, password and pseudonym are deleted, and you&apos;re signed out.</li>
            <li>
              Things you&apos;ve already published stay up, so others can still learn from them. Posts
              and replies will show <strong>&ldquo;Deleted user&rdquo;</strong> instead of your pseudonym.
            </li>
            <li>Nobody — including us — will be able to link that content back to you or your email.</li>
          </ul>
        </div>
        <DeleteAccountForm />
      </div>
    </section>
  );
}
