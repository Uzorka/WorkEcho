// Company and review constants shared by server and client code (no zod here,
// so client bundles stay small). Lists must match the SQL in
// supabase/migrations/20261010120000_companies_reviews.sql (a unit test checks).

export const INDUSTRIES = [
  "Agriculture", "Banking & Finance", "Consulting & Professional Services", "Education",
  "Energy & Power", "FMCG & Manufacturing", "Fintech", "Government & Public Sector",
  "Healthcare & Pharma", "Hospitality & Food", "Insurance", "Logistics & Transport",
  "Media & Entertainment", "NGO & Non-profit", "Oil & Gas", "Real Estate & Construction",
  "Retail & E-commerce", "Technology & Software", "Telecoms", "Other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const SIZE_RANGES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] as const;

export const DEPARTMENTS = {
  sales_marketing: "Sales & Marketing",
  operations_logistics: "Operations & Logistics",
  finance_accounts: "Finance & Accounts",
  hr_admin: "HR & Admin",
  tech_it: "Tech & IT",
  customer_service: "Customer Service",
  production: "Production",
  management: "Management",
  other: "Other",
} as const;
export type Department = keyof typeof DEPARTMENTS;

export const EMPLOYMENT_STATUSES = { current: "Current employee", former: "Former employee" } as const;
export type EmploymentStatus = keyof typeof EMPLOYMENT_STATUSES;

export const EMPLOYMENT_TYPES = { full_time: "Full-time", contract: "Contract", intern: "Intern", nysc: "NYSC" } as const;
export type EmploymentType = keyof typeof EMPLOYMENT_TYPES;

export const YES_NO_SOMETIMES = { yes: "Yes", no: "No", sometimes: "Sometimes" } as const;
export type YesNoSometimes = keyof typeof YES_NO_SOMETIMES;

export const PROBATION_OUTCOMES = { yes: "Yes", no: "No", not_yet: "Not yet" } as const;
export type ProbationOutcome = keyof typeof PROBATION_OUTCOMES;

export const RATING_CATEGORIES = [
  { key: "rating_overall", stat: "avg_overall", label: "Overall" },
  { key: "rating_pay", stat: "avg_pay", label: "Pay & benefits" },
  { key: "rating_work_life", stat: "avg_work_life", label: "Work-life balance" },
  { key: "rating_management", stat: "avg_management", label: "Management" },
  { key: "rating_culture", stat: "avg_culture", label: "Culture" },
  { key: "rating_growth", stat: "avg_growth", label: "Career growth" },
] as const;
export type RatingKey = (typeof RATING_CATEGORIES)[number]["key"];

export const NIGERIA_QUESTIONS = [
  { key: "salary_on_time", question: "Was salary paid on time?", stat: "Salary on time" },
  { key: "overtime_paid", question: "Was overtime paid?", stat: "Overtime paid" },
  { key: "has_hmo", question: "Did you have HMO (health insurance)?", stat: "Has HMO" },
  { key: "pension_remitted", question: "Was your pension remitted?", stat: "Pension remitted" },
  { key: "got_contract", question: "Did you get a written contract?", stat: "Written contract" },
] as const;
export type NigeriaKey = (typeof NIGERIA_QUESTIONS)[number]["key"];

/** CLAUDE.md thresholds (also enforced in SQL views). */
export const MIN_REVIEWS_FOR_RATING = 3;
export const MIN_ANSWERS_FOR_PERCENT = 3;
export const MIN_REVIEWS_FOR_DEPARTMENT = 10;

export const REVIEW_LIMITS = {
  headline: { min: 5, max: 120 },
  pros: { min: 20, max: 3000 },
  cons: { min: 20, max: 3000 },
  advice: { max: 2000 },
} as const;

export const REVIEW_SORTS = { newest: "Newest", helpful: "Most helpful", lowest: "Lowest rated", highest: "Highest rated" } as const;
export type ReviewSort = keyof typeof REVIEW_SORTS;

export const COMPANY_SORTS = { reviews: "Most reviewed", rating: "Highest rated", name: "Name (A–Z)" } as const;
export type CompanySort = keyof typeof COMPANY_SORTS;

export function isKey<T extends object>(obj: T, k: unknown): k is keyof T {
  return typeof k === "string" && Object.prototype.hasOwnProperty.call(obj, k);
}

/** Escape a user search term for a SQL ILIKE pattern. */
export function ilikePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// ---------------------------------------------------------------- salary and interview reports

export const SALARY_LEVELS = { entry: "Entry level", mid: "Mid level", senior: "Senior", manager: "Manager", executive: "Executive" } as const;
export type SalaryLevel = keyof typeof SALARY_LEVELS;

export const BENEFITS = { hmo: "HMO", transport: "Transport", housing: "Housing", thirteenth_month: "13th month", feeding: "Feeding" } as const;
export type Benefit = keyof typeof BENEFITS;

export const INTERVIEW_OUTCOMES = { offer: "Got an offer", no_offer: "No offer", ghosted: "Ghosted", withdrew: "I withdrew" } as const;
export type InterviewOutcome = keyof typeof INTERVIEW_OUTCOMES;

export const INTERVIEW_STAGES = {
  aptitude_test: "Aptitude test",
  phone_call: "Phone call",
  panel: "Panel interview",
  assessment: "Assessment / case study",
  final_interview: "Final interview",
} as const;
export type InterviewStage = keyof typeof INTERVIEW_STAGES;

export const INTERVIEW_EXPERIENCES = { positive: "Positive", neutral: "Neutral", negative: "Negative" } as const;
export type InterviewExperience = keyof typeof INTERVIEW_EXPERIENCES;

/** Monthly gross pay bounds (also a CHECK constraint in SQL). */
export const SALARY_MIN_NAIRA = 30_000;
export const SALARY_MAX_NAIRA = 50_000_000;
export const MIN_REPORTS_FOR_SALARY = 3;
export const MIN_REPORTS_FOR_INTERVIEW_SUMMARY = 3;

export const INTERVIEW_LIMITS = { questions: { min: 10, max: 3000 }, tips: { max: 2000 }, weeks: { max: 52 } } as const;

const nairaFormat = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 });

/** "₦520,000" */
export function formatNaira(amount: number): string {
  return `₦${nairaFormat.format(amount)}`;
}

/** Parses what people type: "250,000", "₦ 250000", "250000.00". Returns null if it isn't a whole number. */
export function parseNaira(input: unknown): number | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const cleaned = String(input).replace(/naira|ngn|₦|,|\s/gi, "").replace(/\.0+$/, "");
  if (!/^\d{1,12}$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** Same rounding as the SQL view: nearest ₦10,000, halves away from zero. */
export function roundToNearest10k(amount: number): number {
  return Math.round(amount / 10_000) * 10_000;
}
