import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { PRIVACY_EMAIL } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro="This explains what WorkEcho stores about you, why, for how long, and how to get it deleted. We follow the Nigeria Data Protection Act 2023 (NDPA)."
    >
      <h2>The short version</h2>
      <ul>
        <li>We only need an email address and a password. You appear under a generated pseudonym.</li>
        <li>We never ask for your real name, phone number, photo, exact job title or exact dates of employment.</li>
        <li>Reviews, salaries and interview reports don&apos;t show your pseudonym. Posts and replies do.</li>
        <li>We never sell your data and we don&apos;t use advertising trackers.</li>
        <li>We protect your identity, but what you write can still reveal you. No website can promise to be 100% anonymous.</li>
      </ul>

      <h2>Who we are</h2>
      <p>
        WorkEcho (&ldquo;we&rdquo;) is the data controller for the personal data described here. Contact us about privacy at{" "}
        <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Account:</strong> your email address and a securely hashed password (we can&apos;t read your password), plus the date you joined.
        </li>
        <li>
          <strong>Profile:</strong> your pseudonym, whether you are a current employee, former employee or job seeker, and your state if you choose to
          share it.
        </li>
        <li>
          <strong>What you write:</strong> reviews, salary reports, interview reports, posts and replies, and the company and dates attached to them.
        </li>
        <li>
          <strong>Activity:</strong> likes, &ldquo;helpful&rdquo; votes, reports you send, your notifications, and the time of each post, reply, review and
          report (to enforce posting limits).
        </li>
        <li>
          <strong>Technical:</strong> a login cookie to keep you signed in. Our hosting providers keep short-term server logs, which can include IP
          addresses, to keep the service secure.
        </li>
        <li>
          <strong>On your device only:</strong> your light/dark theme choice and unfinished review drafts are saved in your browser, not on our servers.
        </li>
      </ul>

      <h2>How we keep it separate</h2>
      <p>
        Public pages never show your email or account ID. Reviews, salaries and interview reports are published after a random delay of 12–72 hours and
        show only the quarter (for example &ldquo;Q3 2026&rdquo;), so the timing can&apos;t point to you. Salaries only appear as ranges once at least three
        people have reported the same role and level. Moderators see pseudonyms, not emails; an email is only looked at to enforce a ban, and every such
        look is logged.
      </p>

      <h2>Why we use it (lawful basis)</h2>
      <ul>
        <li>
          <strong>To run your account and show what you post</strong> — performing our agreement with you (our <Link href="/terms">terms</Link>).
        </li>
        <li>
          <strong>To keep WorkEcho safe</strong> (rate limits, reports, moderation, bans) — our legitimate interest in a trustworthy service.
        </li>
        <li>
          <strong>Optional details</strong> such as your state — your consent, which you can withdraw by removing them.
        </li>
        <li>
          <strong>Legal requests</strong> — where Nigerian law requires us to keep or disclose data.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account and profile: until you delete your account.</li>
        <li>
          Content you published: it stays up after you delete your account, but is no longer linked to you. Posts and replies then show &ldquo;Deleted
          user&rdquo;. You can delete any item yourself before deleting your account.
        </li>
        <li>Reports and moderation records: kept while needed to handle disputes and repeat abuse. (Exact period to be confirmed before launch.)</li>
        <li>Posting-limit timestamps: kept only to enforce limits. (Exact period to be confirmed before launch.)</li>
        <li>Server logs: kept by our hosting providers for a short period under their own policies.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        We use service providers to host the website and database (currently Vercel and Supabase). They process data only on our instructions. Their
        servers may be outside Nigeria; where that happens we rely on the safeguards the NDPA requires for cross-border transfers. We do not share your
        identity with employers. We would only disclose account data if Nigerian law requires it, for example under a valid court order, and we would
        tell you where the law allows.
      </p>

      <h2>Your rights</h2>
      <p>Under the NDPA you can ask us to:</p>
      <ul>
        <li>give you a copy of the personal data we hold about you;</li>
        <li>correct data that is wrong;</li>
        <li>delete your data;</li>
        <li>restrict or object to how we use it;</li>
        <li>move it to another service (data portability);</li>
        <li>withdraw consent you gave earlier.</li>
      </ul>
      <p>
        Email <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> from the address on your account. We aim to reply within 30 days. If you are not
        happy with our answer, you can complain to the Nigeria Data Protection Commission (NDPC).
      </p>

      <h2>Deleting your account</h2>
      <p>
        Go to <Link href="/me">Me</Link> → <strong>Delete my account</strong>. This deletes your email, password and pseudonym straight away and signs you
        out. To remove particular content first, open it and choose Delete, or email us.
      </p>

      <h2>Children</h2>
      <p>WorkEcho is for people aged 18 and over.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we&apos;ll say so on the site before the change takes effect.</p>
    </LegalPage>
  );
}
