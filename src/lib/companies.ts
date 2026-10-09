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
