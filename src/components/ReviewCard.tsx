import type { ReactNode } from "react";
import {
  DEPARTMENTS,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  NIGERIA_QUESTIONS,
  PROBATION_OUTCOMES,
  YES_NO_SOMETIMES,
  isKey,
} from "@/lib/companies";
import { stateLabel } from "@/lib/nigeria";
import { Stars } from "./Stars";
import { CheckIcon } from "./CheckIcon";

// One review as readers see it. NO pseudonym: only status, department, type,
// state and quarter. Pure component, also used for the preview in the form.

export type ReviewCardData = {
  employment_status: string;
  department: string | null;
  employment_type: string;
  state: string | null;
  rating_overall: number;
  salary_on_time: string | null;
  overtime_paid: string | null;
  has_hmo: string | null;
  pension_remitted: string | null;
  got_contract: string | null;
  probation_months: number | null;
  confirmed_after_probation: string | null;
  headline: string;
  pros: string;
  cons: string;
  advice_to_management: string | null;
  published_quarter: string;
  is_verified?: boolean;
};

export function reviewMeta(r: Pick<ReviewCardData, "employment_status" | "department" | "employment_type" | "state" | "published_quarter">) {
  return [
    isKey(EMPLOYMENT_STATUSES, r.employment_status) ? EMPLOYMENT_STATUSES[r.employment_status] : null,
    isKey(DEPARTMENTS, r.department) ? DEPARTMENTS[r.department] : null,
    isKey(EMPLOYMENT_TYPES, r.employment_type) ? EMPLOYMENT_TYPES[r.employment_type] : null,
    r.state ? stateLabel(r.state) : null,
    r.published_quarter,
  ].filter(Boolean) as string[];
}

export function ReviewCard({ review, footer, as: Heading = "h3" }: { review: ReviewCardData; footer?: ReactNode; as?: "h2" | "h3" }) {
  const answers = NIGERIA_QUESTIONS.filter((q) => review[q.key]);
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-col gap-1">
        <Stars value={review.rating_overall} />
        <Heading className="text-lg font-semibold break-words">{review.headline}</Heading>
        {review.is_verified && <VerifiedLabel former={review.employment_status === "former"} />}
        <p className="text-sm text-muted">{reviewMeta(review).join(" · ")}</p>
      </div>
      <div>
        <h4 className="text-sm font-semibold">Pros</h4>
        <p className="whitespace-pre-line break-words">{review.pros}</p>
      </div>
      <div>
        <h4 className="text-sm font-semibold">Cons</h4>
        <p className="whitespace-pre-line break-words">{review.cons}</p>
      </div>
      {review.advice_to_management && (
        <div>
          <h4 className="text-sm font-semibold">Advice to management</h4>
          <p className="whitespace-pre-line break-words">{review.advice_to_management}</p>
        </div>
      )}
      {(answers.length > 0 || review.probation_months !== null || review.confirmed_after_probation) && (
        <ul className="flex flex-wrap gap-2 text-xs" aria-label="Answers about pay and benefits">
          {answers.map((q) => {
            const v = review[q.key];
            return (
              <li key={q.key} className="rounded-full bg-primary-soft px-3 py-1">
                {q.stat}: {isKey(YES_NO_SOMETIMES, v) ? YES_NO_SOMETIMES[v] : v}
              </li>
            );
          })}
          {review.probation_months !== null && (
            <li className="rounded-full bg-primary-soft px-3 py-1">
              Probation: {review.probation_months} {review.probation_months === 1 ? "month" : "months"}
            </li>
          )}
          {isKey(PROBATION_OUTCOMES, review.confirmed_after_probation) && (
            <li className="rounded-full bg-primary-soft px-3 py-1">
              Confirmed after probation: {PROBATION_OUTCOMES[review.confirmed_after_probation]}
            </li>
          )}
        </ul>
      )}
      {footer}
    </article>
  );
}

/** "✓ Verified employee" on reviews and reports written by someone verified at that company. */
export function VerifiedLabel({ former = false }: { former?: boolean }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
      <CheckIcon size={16} />
      {former ? "Verified former employee" : "Verified employee"}
    </p>
  );
}
