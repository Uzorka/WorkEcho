import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Community guidelines" };

export default function GuidelinesPage() {
  return (
    <LegalPage
      title="Community guidelines"
      intro="WorkEcho works when people can be honest and safe. Good, mixed and bad experiences are all welcome. These rules keep it fair for workers, job seekers and companies."
    >
      <h2>Do</h2>
      <ul>
        <li>Write about the company: its pay, culture, management style, processes and how it treats staff.</li>
        <li>Share what you saw or experienced yourself.</li>
        <li>Be specific about patterns (&ldquo;salary was often two weeks late&rdquo;) rather than one-off moments only you were part of.</li>
        <li>Keep it useful for the next person deciding whether to take a job.</li>
      </ul>

      <h2>Don&apos;t</h2>
      <ul>
        <li>
          <strong>Name or describe individuals.</strong> Review the company, not your manager by name. &ldquo;The HR team&rdquo; is fine; &ldquo;Mrs
          A. in HR&rdquo; is not.
        </li>
        <li>
          <strong>Accuse anyone of a crime you can&apos;t prove.</strong> Describe what happened; leave the conclusions to the courts.
        </li>
        <li>
          <strong>Share confidential documents</strong>, trade secrets or internal files.
        </li>
        <li>
          <strong>Threaten, harass or abuse</strong> anyone, including other users.
        </li>
        <li>
          <strong>Post contact details</strong>: phone numbers, email addresses, home addresses, staff IDs or account numbers — yours or anyone else&apos;s. We block
          phone numbers and emails automatically.
        </li>
        <li>
          <strong>Post fake content</strong>: reviews of places you never worked, made-up salaries, or several accounts for one person.
        </li>
        <li>Spam, advertise or post the same thing again and again.</li>
      </ul>

      <h2>Protect yourself</h2>
      <p>
        We protect your identity, but what you write can still reveal you. If only a few people know a detail — a project, a date, a conversation —
        mentioning it could point to you. We warn you before posting when we spot things like phone numbers, staff IDs or long numbers, but the check
        isn&apos;t perfect. Read your text again before you post.
      </p>

      <h2>Reporting</h2>
      <p>
        Every post, reply, review, interview report and salary group has a <strong>Report</strong> button. Reports are anonymous: only our moderators
        can see who sent them. When three different people report the same item, we hide it automatically until a moderator has looked at it.
      </p>

      <h2>What moderators do</h2>
      <ul>
        <li>Remove content that breaks these rules. We don&apos;t remove content just because it is negative or a company dislikes it.</li>
        <li>Send a warning for a first or minor problem.</li>
        <li>Ban accounts for serious or repeated problems. Banned accounts can still read, but can&apos;t post, reply, review or report.</li>
        <li>Log every action so decisions can be checked later.</li>
      </ul>

      <h2>Companies</h2>
      <p>
        Employers can never pay to hide reviews or change ratings. If a company believes something breaks these rules, it can ask for a review — see the{" "}
        <Link href="/terms#complaints">complaints section of our terms</Link>.
      </p>
    </LegalPage>
  );
}
