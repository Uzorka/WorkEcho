import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/forms";
import { buttonClass, secondaryButtonClass } from "@/components/styles";
import { Notice } from "@/components/Notice";
import { getOrCreateMyProfile, requireUser } from "@/lib/auth";
import { MAX_PSEUDONYM_REGENERATIONS } from "@/lib/pseudonym";
import { AboutYouForm } from "./AboutYouForm";
import { finish, regenerate } from "./actions";

export const metadata: Metadata = { title: "Set up your account" };

const STEPS = ["About WorkEcho", "About you", "Your pseudonym"];

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const user = await requireUser("/onboarding");
  const profile = await getOrCreateMyProfile(user.id);

  let step = Math.min(Math.max(Number(params.step) || 1, 1), 3);
  if (step === 3 && !profile.user_type) step = 2;

  const left = MAX_PSEUDONYM_REGENERATIONS - profile.pseudonym_regenerations;

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted">
          Step {step} of {STEPS.length}: {STEPS[step - 1]}
        </p>
        <div
          role="progressbar"
          aria-label="Setup progress"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step}
          className="flex gap-2"
        >
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>
      </div>

      {step > 1 && (
        <Link href={`/onboarding?step=${step - 1}`} className="-my-2 self-start py-2 text-sm font-medium text-primary underline">
          ← Back
        </Link>
      )}

      {step === 1 && (
        <>
          <h1 className="text-2xl font-bold tracking-tight">Welcome to WorkEcho</h1>
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
            <p>
              WorkEcho is where Nigerian workers share what companies are really like — pay, interviews,
              culture, and whether salary comes on time — so job seekers can decide with their eyes open.
            </p>
            <h2 className="font-semibold">How we protect you</h2>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              <li>You appear under a generated pseudonym, never your name or email.</li>
              <li>Reviews and salary reports don&apos;t show your pseudonym at all.</li>
              <li>We never ask for your phone number, photo or exact job title.</li>
            </ul>
            <h2 className="font-semibold">What we can&apos;t protect</h2>
            <p className="text-sm">
              We protect your identity, but what you write can still reveal you. If only a few people
              know a detail — a project, a date, a conversation — mentioning it could point to you.
              Write about patterns, not moments only you were part of.
            </p>
          </div>
          <Link href="/onboarding?step=2" className={buttonClass}>
            Continue
          </Link>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="text-2xl font-bold tracking-tight">Who are you?</h1>
          <p className="text-muted">This helps readers weigh what you share. It isn&apos;t linked to any company.</p>
          <div className="rounded-2xl border border-border bg-card p-5">
            <AboutYouForm userType={profile.user_type} state={profile.state} />
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="text-2xl font-bold tracking-tight">Your pseudonym</h1>
          {params.notice === "limit" && <Notice>You&apos;ve used all your changes, so this is your pseudonym.</Notice>}
          {params.notice === "error" && <Notice>Something went wrong. Please try again.</Notice>}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted">Others will see you as</p>
            <p className="text-3xl font-bold break-all text-primary" data-testid="pseudonym">
              {profile.pseudonym}
            </p>
            <p className="text-sm text-muted">
              It appears on your posts and replies. It can&apos;t be changed after you finish.
            </p>
            {left > 0 ? (
              <form action={regenerate}>
                <SubmitButton className={secondaryButtonClass} pendingText="Generating…">
                  Give me another ({left} {left === 1 ? "change" : "changes"} left)
                </SubmitButton>
              </form>
            ) : (
              <p className="text-sm text-muted">No changes left.</p>
            )}
          </div>
          <form action={finish} className="flex flex-col">
            <SubmitButton pendingText="Finishing…">Finish</SubmitButton>
          </form>
        </>
      )}
    </section>
  );
}
