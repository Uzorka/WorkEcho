import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ilikePattern, type CompanySort, type ReviewSort } from "./companies";

// Read helpers for companies and reviews. Everything here reads safe views
// or RPCs (never author ids), except getMyReview/getMyVotes, which read the
// caller's own rows through RLS + column grants.

export const COMPANIES_PER_PAGE = 20;
export const REVIEWS_PER_PAGE = 10;

export type CompanyStats = {
  company_id: string;
  name: string;
  slug: string;
  industry: string;
  state: string | null;
  city: string | null;
  size_range: string | null;
  review_count: number;
  avg_overall: number | null;
  avg_pay: number | null;
  avg_work_life: number | null;
  avg_management: number | null;
  avg_culture: number | null;
  avg_growth: number | null;
  salary_on_time_answers: number;
  salary_on_time_yes_pct: number | null;
  overtime_paid_answers: number;
  overtime_paid_yes_pct: number | null;
  has_hmo_answers: number;
  has_hmo_yes_pct: number | null;
  pension_remitted_answers: number;
  pension_remitted_yes_pct: number | null;
  got_contract_answers: number;
  got_contract_yes_pct: number | null;
  verified_review_count: number;
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  industry: string;
  state: string | null;
  city: string | null;
  website: string | null;
  size_range: string | null;
  description: string | null;
  email_domains: string[];
};

export type PublicReview = {
  id: string;
  employment_status: "current" | "former";
  department: string | null;
  employment_type: string;
  state: string | null;
  rating_overall: number;
  rating_pay: number;
  rating_work_life: number;
  rating_management: number;
  rating_culture: number;
  rating_growth: number;
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
  helpful_count: number;
  is_verified: boolean;
};

export async function listCompanies({
  q,
  industry,
  state,
  sort,
  page,
}: {
  q?: string;
  industry?: string;
  state?: string;
  sort: CompanySort;
  page: number;
}) {
  const supabase = await createClient();
  let query = supabase.from("company_stats").select("*", { count: "exact" });
  if (q) query = query.ilike("name", ilikePattern(q));
  if (industry) query = query.eq("industry", industry);
  if (state) query = query.eq("state", state);
  if (sort === "rating")
    query = query.order("avg_overall", { ascending: false, nullsFirst: false }).order("review_count", { ascending: false });
  else if (sort === "reviews") query = query.order("review_count", { ascending: false });
  query = query.order("name").order("company_id");

  const from = (page - 1) * COMPANIES_PER_PAGE;
  const { data, count, error } = await query.range(from, from + COMPANIES_PER_PAGE - 1);
  if (error) throw new Error("Could not load companies");
  return { companies: (data ?? []) as CompanyStats[], total: count ?? 0 };
}

/** Cached per request, so the tab layout and the tab page share one query. */
export const getCompany = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name, slug, industry, state, city, website, size_range, description, email_domains")
    .eq("slug", slug)
    .maybeSingle();
  return data as Company | null;
});

export async function getCompanyStats(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("company_stats").select("*").eq("company_id", companyId).maybeSingle();
  return data as CompanyStats | null;
}

export async function getDepartmentStats(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("company_department_stats")
    .select("department, review_count, avg_overall")
    .eq("company_id", companyId)
    .order("review_count", { ascending: false });
  return (data ?? []) as { department: string; review_count: number; avg_overall: number }[];
}

/** Verified reviews come first (then the chosen sort); optionally verified only. */
export async function getReviews(companyId: string, sort: ReviewSort, page: number, verifiedOnly = false) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("company_reviews", {
    p_company_id: companyId,
    p_sort: sort,
    p_limit: REVIEWS_PER_PAGE,
    p_offset: (page - 1) * REVIEWS_PER_PAGE,
    p_verified_only: verifiedOnly,
  });
  if (error) throw new Error("Could not load reviews");
  return (data ?? []) as PublicReview[];
}

export const MY_REVIEW_COLUMNS =
  "id, employment_status, department, employment_type, state, rating_overall, rating_pay, rating_work_life, rating_management, rating_culture, rating_growth, salary_on_time, overtime_paid, has_hmo, pension_remitted, got_contract, probation_months, confirmed_after_probation, headline, pros, cons, advice_to_management, status";

export type MyReview = Omit<PublicReview, "published_quarter" | "helpful_count" | "is_verified"> & { status: string };

/** The signed-in user's own review of a company (RLS: own rows only). */
export async function getMyReview(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("reviews").select(MY_REVIEW_COLUMNS).eq("company_id", companyId).maybeSingle();
  return data as MyReview | null;
}

/** Which of these reviews the signed-in user marked helpful. */
export async function getMyVotes(reviewIds: string[]) {
  if (!reviewIds.length) return new Set<string>();
  const supabase = await createClient();
  const { data } = await supabase.from("review_helpful").select("review_id").in("review_id", reviewIds);
  return new Set((data ?? []).map((r) => r.review_id as string));
}

// ---------------------------------------------------------------- salaries and interviews

export const INTERVIEWS_PER_PAGE = 10;

export type SalaryGroup = {
  role_group: string;
  level: string;
  report_count: number;
  median_naira: number;
  lowest_naira: number;
  highest_naira: number;
  verified_count: number;
};

/** Salary ranges for groups with >= 3 reports. Individual salaries are never readable. */
export async function getSalaryStats(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_salary_stats")
    .select("role_group, level, report_count, median_naira, lowest_naira, highest_naira, verified_count")
    .eq("company_id", companyId)
    .order("role_group")
    .order("level");
  if (error) throw new Error("Could not load salaries");
  return (data ?? []) as SalaryGroup[];
}

export type InterviewStats = {
  report_count: number;
  offer_pct: number | null;
  ghosted_pct: number | null;
  avg_weeks: number | null;
  avg_difficulty: number | null;
  positive_pct: number | null;
};

export type PublicInterview = {
  id: string;
  role_group: string;
  outcome: string;
  difficulty: number;
  process_weeks: number | null;
  stages: string[];
  questions_asked: string;
  tips: string | null;
  experience: string;
  published_quarter: string;
  is_verified: boolean;
};

/** Visible counts per section, for the tab labels. */
export const getCompanyCounts = cache(async (companyId: string) => {
  const supabase = await createClient();
  const [reviews, salaries, interviews] = await Promise.all([
    supabase.from("company_stats").select("review_count").eq("company_id", companyId).maybeSingle(),
    supabase.from("company_salary_counts").select("report_count").eq("company_id", companyId).maybeSingle(),
    supabase.from("company_interview_stats").select("report_count").eq("company_id", companyId).maybeSingle(),
  ]);
  return {
    reviews: (reviews.data?.review_count as number) ?? 0,
    salaries: (salaries.data?.report_count as number) ?? 0,
    interviews: (interviews.data?.report_count as number) ?? 0,
  };
});

export async function getInterviewStats(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("company_interview_stats").select("*").eq("company_id", companyId).maybeSingle();
  return data as InterviewStats | null;
}

export async function getInterviews(companyId: string, page: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("company_interviews", {
    p_company_id: companyId,
    p_limit: INTERVIEWS_PER_PAGE,
    p_offset: (page - 1) * INTERVIEWS_PER_PAGE,
  });
  if (error) throw new Error("Could not load interviews");
  return (data ?? []) as PublicInterview[];
}

export type MySalary = {
  id: string;
  role_group: string;
  level: string;
  employment_type: string;
  state: string | null;
  monthly_gross_naira: number;
  has_bonus: boolean;
  other_benefits: string[];
  status: string;
};

/** The signed-in user's own salary report (RLS: own rows only). */
export async function getMySalary(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("salary_reports")
    .select("id, role_group, level, employment_type, state, monthly_gross_naira, has_bonus, other_benefits, status")
    .eq("company_id", companyId)
    .maybeSingle();
  return data as MySalary | null;
}

export type MyInterview = Omit<PublicInterview, "published_quarter" | "is_verified"> & { status: string };

export async function getMyInterview(companyId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("interview_reports")
    .select("id, role_group, outcome, difficulty, process_weeks, stages, questions_asked, tips, experience, status")
    .eq("company_id", companyId)
    .maybeSingle();
  return data as MyInterview | null;
}
