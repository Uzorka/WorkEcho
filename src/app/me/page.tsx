import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { SubmitButton } from "@/components/forms";
import { Notice } from "@/components/Notice";
import { secondaryButtonClass } from "@/components/styles";
import { getMyProfile, requireUser } from "@/lib/auth";
import { USER_TYPE_LABELS } from "@/lib/account-constants";
import { stateLabel } from "@/lib/nigeria";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { DeleteAccountForm } from "./DeleteAccountForm";

export const metadata: Metadata = { title: "Me" };

const NOTICES: Record<string, string> = {
  welcome: "You're all set. Welcome to WorkEcho!",
  "password-updated": "Your new password is saved.",
};

export default async function MePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { notice } = await searchParams;
  await requireUser("/me");
  const profile = await getMyProfile();
  if (!profile?.onboarded_at || !profile.user_type) redirect("/onboarding");

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Me</h1>
      {notice && NOTICES[notice] && <Notice>{NOTICES[notice]}</Notice>}

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted">Your pseudonym</p>
        <p className="text-2xl font-bold break-all text-primary" data-testid="pseudonym">
          {profile.pseudonym}
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
