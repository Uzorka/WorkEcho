import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { TAKEDOWN_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" intro="The rules for using WorkEcho. By creating an account you agree to them. Reading without an account is free and needs no sign-up.">
      <h2>1. Who can use WorkEcho</h2>
      <ul>
        <li>You must be 18 or older.</li>
        <li>One person, one account. Use a personal email, not your work email.</li>
        <li>Keep your password safe. You are responsible for what is posted from your account.</li>
      </ul>

      <h2>2. What you post</h2>
      <ul>
        <li>Post only honest accounts of your own experience, following our <Link href="/guidelines">community guidelines</Link>.</li>
        <li>
          You keep ownership of what you write. You give WorkEcho a free, worldwide, non-exclusive licence to host, display and share it on WorkEcho, including
          after you delete your account (without linking it to you).
        </li>
        <li>Content is the opinion of the person who wrote it, not of WorkEcho. We don&apos;t check every claim and can&apos;t promise it is accurate.</li>
      </ul>

      <h2>3. What you must not do</h2>
      <ul>
        <li>Break the community guidelines, including naming individuals, unproven crime accusations, confidential documents, threats or contact details.</li>
        <li>Try to find out who wrote something, or publish someone else&apos;s identity.</li>
        <li>Use bots, scrape the site, get around posting limits, or create several accounts.</li>
        <li>Break Nigerian law or anyone&apos;s rights.</li>
      </ul>

      <h2>4. Moderation</h2>
      <p>
        We may hide or remove content, warn users, and suspend or ban accounts that break these terms. Banned accounts can still read but can&apos;t post.
        Content reported by three different people is hidden automatically until a moderator reviews it. Every moderation action is logged.
      </p>

      <h2 id="complaints">5. Complaints from companies and others</h2>
      <p>
        If you believe content on WorkEcho is unlawful or breaks our guidelines (for example it names an individual, makes an unproven accusation of a crime
        or reveals confidential information), email <a href={`mailto:${TAKEDOWN_EMAIL}`}>{TAKEDOWN_EMAIL}</a> with:
      </p>
      <ol>
        <li>a link to each item;</li>
        <li>what is wrong with it and why;</li>
        <li>your name, organisation and how we can reach you.</li>
      </ol>
      <p>
        We will acknowledge your email, review the content against our guidelines and the law, and tell you what we decided. We do not remove content only
        because it is negative. Employers can never pay to hide reviews or change ratings. We will not reveal who wrote something unless Nigerian law
        requires it, for example under a valid court order.
      </p>

      <h2>6. Ending your account</h2>
      <p>
        You can delete your account at any time from <Link href="/me">Me</Link>. We may close accounts that break these terms.
      </p>

      <h2>7. Our responsibility</h2>
      <p>
        WorkEcho is provided &ldquo;as is&rdquo;. We work to keep it available and safe, but we can&apos;t promise it will always be error-free. Decisions you
        make about jobs are your own; use WorkEcho as one source among many. Nothing in these terms limits rights you have under Nigerian consumer law.
      </p>

      <h2>8. Law</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria. Our <Link href="/privacy">privacy policy</Link> explains how we handle personal data.</p>

      <h2>9. Changes</h2>
      <p>If we change these terms in a way that matters, we&apos;ll say so on the site before the change takes effect.</p>
    </LegalPage>
  );
}
