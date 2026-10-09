import "server-only";
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

export async function getCompany(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("companies")
    .select("id, name, slug, industry, state, city, website, size_range, description")
    .eq("slug", slug)
    .maybeSingle();
  return data as Company | null;
}

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

export async function getReviews(companyId: string, sort: ReviewSort, page: number) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("company_reviews", {
    p_company_id: companyId,
    p_sort: sort,
    p_limit: REVIEWS_PER_PAGE,
    p_offset: (page - 1) * REVIEWS_PER_PAGE,
  });
  if (error) throw new Error("Could not load reviews");
  return (data ?? []) as PublicReview[];
}

export const MY_REVIEW_COLUMNS =
  "id, employment_status, department, employment_type, state, rating_overall, rating_pay, rating_work_life, rating_management, rating_culture, rating_growth, salary_on_time, overtime_paid, has_hmo, pension_remitted, got_contract, probation_months, confirmed_after_probation, headline, pros, cons, advice_to_management, status";

export type MyReview = Omit<PublicReview, "published_quarter" | "helpful_count"> & { status: string };

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
