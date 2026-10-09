import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon } from "@/components/CheckIcon";

export const metadata: Metadata = { title: "How checkmarks work" };

export default function VerificationPage() {
  return (
    <article className="flex flex-col gap-5 [&_h2]:mt-2 [&_h2]:text-xl [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
        <span className="text-primary">
          <CheckIcon size={28} />
        </span>
        How checkmarks work
      </h1>
      <p className="text-muted">
        A checkmark means a person proved they work or worked at a company on WorkEcho. It is earned through verification and can never be
        bought — not by users, not by employers, not by anyone.
      </p>

      <h2>How to get one</h2>
      <ul>
        <li>Go to Me → Get verified, choose your company and enter your work email.</li>
        <li>We email you a 6-digit code. Enter it within 15 minutes.</li>
        <li>That&apos;s it. The checkmark lasts 12 months, and you can renew it in the last 30 days.</li>
      </ul>

      <h2>What we keep — and don&apos;t</h2>
      <ul>
        <li>We never save your work email. We use it once to send the code, then forget it.</li>
        <li>We keep only that your account verified with a company, when, and when it expires. Only you can see which company.</li>
        <li>Your public checkmark never says which company you verified with.</li>
        <li>
          Heads up: your company&apos;s email system may record that WorkEcho sent you an email. Only verify if you&apos;re comfortable with that.
        </li>
      </ul>

      <h2>What it changes</h2>
      <ul>
        <li>A checkmark shows next to your pseudonym on posts and replies.</li>
        <li>Your reviews, salary and interview reports for that company show &ldquo;Verified employee&rdquo; and appear first in lists.</li>
        <li>Verified reviews count double in company ratings. The &ldquo;enough reviews&rdquo; thresholds still count people, not weight.</li>
        <li>Verified posts get a small boost in &ldquo;Top this week&rdquo; (worth one extra like).</li>
        <li>Verified accounts get double the posting limits.</li>
      </ul>

      <h2>Can a checkmark be taken away?</h2>
      <p>
        Yes. It expires after 12 months unless renewed, and moderators can remove it if it was misused. Banned accounts lose their checkmarks
        automatically. Moderators can remove checkmarks, but they can never give them out.
      </p>

      <h2>Can employers pay for one, or pay to hide reviews?</h2>
      <p>
        No. Checkmarks aren&apos;t connected to any payment or subscription, and employers can never pay to hide reviews or change ratings.
      </p>

      <p>
        <Link href="/me/verify" className="font-medium text-primary underline">
          Get verified
        </Link>
      </p>
    </article>
  );
}
