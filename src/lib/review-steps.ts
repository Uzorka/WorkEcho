import { RATING_CATEGORIES, REVIEW_LIMITS } from "./companies";

// Client-side, per-step checks for the review form. The server re-validates
// everything with reviewSchema; these just give quick feedback per step.

export type ReviewValues = Record<
  | "employment_status" | "department" | "employment_type" | "state"
  | "rating_overall" | "rating_pay" | "rating_work_life" | "rating_management" | "rating_culture" | "rating_growth"
  | "salary_on_time" | "overtime_paid" | "has_hmo" | "pension_remitted" | "got_contract"
  | "probation_months" | "confirmed_after_probation"
  | "headline" | "pros" | "cons" | "advice_to_management",
  string
>;

export const EMPTY_REVIEW: ReviewValues = {
  employment_status: "", department: "", employment_type: "", state: "",
  rating_overall: "", rating_pay: "", rating_work_life: "", rating_management: "", rating_culture: "", rating_growth: "",
  salary_on_time: "", overtime_paid: "", has_hmo: "", pension_remitted: "", got_contract: "",
  probation_months: "", confirmed_after_probation: "",
  headline: "", pros: "", cons: "", advice_to_management: "",
};

/** Fields on each step (index 0 = step 1). */
export const REVIEW_STEP_FIELDS: (keyof ReviewValues)[][] = [
  ["employment_status", "department", "employment_type", "state"],
  RATING_CATEGORIES.map((c) => c.key),
  ["salary_on_time", "overtime_paid", "has_hmo", "pension_remitted", "got_contract", "probation_months", "confirmed_after_probation"],
  ["headline", "pros", "cons", "advice_to_management"],
];

export function validateReviewStep(step: number, v: ReviewValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 1) {
    if (!v.employment_status) e.employment_status = "Are you a current or former employee?";
    if (!v.employment_type) e.employment_type = "Choose your employment type.";
  }
  if (step === 2) {
    for (const c of RATING_CATEGORIES) if (!/^[1-5]$/.test(v[c.key])) e[c.key] = "Choose a rating from 1 to 5.";
  }
  if (step === 4) {
    const L = REVIEW_LIMITS;
    if (v.headline.trim().length < L.headline.min) e.headline = `The headline needs at least ${L.headline.min} characters.`;
    if (v.pros.trim().length < L.pros.min) e.pros = `Pros needs at least ${L.pros.min} characters.`;
    if (v.cons.trim().length < L.cons.min) e.cons = `Cons needs at least ${L.cons.min} characters.`;
    if (v.advice_to_management.trim().length > L.advice.max) e.advice_to_management = `Advice can be at most ${L.advice.max} characters.`;
  }
  return e;
}
