import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Stars } from "@/components/Stars";
import { buttonClass, secondaryButtonClass } from "@/components/styles";
import { getUser } from "@/lib/auth";
import {
  getCompany,
  getCompanyCounts,
  getCompanyStats,
  getDepartmentStats,
  getInterviewStats,
  getMyInterview,
  getMyReview,
  getMySalary,
  getSalaryStats,
  type CompanyStats,
} from "@/lib/company-data";
import {
  DEPARTMENTS,
  MIN_ANSWERS_FOR_PERCENT,
  MIN_REVIEWS_FOR_DEPARTMENT,
  MIN_REVIEWS_FOR_RATING,
  NIGERIA_QUESTIONS,
  RATING_CATEGORIES,
  isKey,
} from "@/lib/companies";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await getCompany((await params).slug);
  return { title: company ? `${company.name}: reviews, salaries and interviews` : "Company not found" };
}

export default async function CompanyOverviewPage({ params }: Props) {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) notFound();

  const [stats, departments, salaries, interviews, counts, user] = await Promise.all([
    getCompanyStats(company.id),
    getDepartmentStats(company.id),
    getSalaryStats(company.id),
    getInterviewStats(company.id),
    getCompanyCounts(company.id),
    getUser(),
  ]);
  const [myReview, mySalary, myInterview] = user
    ? await Promise.all([getMyReview(company.id), getMySalary(company.id), getMyInterview(company.id)])
    : [null, null, null];
  const count = stats?.review_count ?? 0;
  const base = `/companies/${slug}`;

  return (
    <div className="flex flex-col gap-6">
      {(company.description || company.website) && (
        <div className="flex flex-col gap-2">
          {company.description && <p>{company.description}</p>}
          {company.website && (
            <a href={company.website} rel="nofollow noopener noreferrer" target="_blank" className="self-start py-2 text-sm font-medium text-primary underline">
              Company website
            </a>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Share what you know</h2>
        <div className="flex flex-wrap gap-2">
          <Link href={`${base}/review`} className={buttonClass}>
            {myReview ? "Edit your review" : "Write a review"}
          </Link>
          <Link href={`${base}/salary`} className={secondaryButtonClass}>
            {mySalary ? "Edit your salary" : "Add a salary"}
          </Link>
          <Link href={`${base}/interview`} className={secondaryButtonClass}>
            {myInterview ? "Edit your interview" : "Share an interview"}
          </Link>
        </div>
      </div>

      {/* Ratings */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Ratings</h2>
        {stats?.avg_overall != null ? (
          <>
            <div className="flex flex-col gap-1">
              <Stars value={stats.avg_overall} size="lg" />
              <p className="text-sm text-muted">
                Overall, from{" "}
                <Link href={`${base}/reviews`} className="underline">
                  {count} {count === 1 ? "review" : "reviews"}
                </Link>
              </p>
            </div>
            <dl className="flex flex-col gap-2">
              {RATING_CATEGORIES.filter((c) => c.key !== "rating_overall").map((c) => {
                const v = stats[c.stat as keyof CompanyStats] as number | null;
                return (
                  <div key={c.key} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                    <dt>{c.label}</dt>
                    <dd className="h-2 overflow-hidden rounded-full bg-primary-soft" aria-hidden>
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${((v ?? 0) / 5) * 100}%` }} />
                    </dd>
                    <dd className="text-right font-semibold">{v?.toFixed(1)}</dd>
                  </div>
                );
              })}
            </dl>
          </>
        ) : (
          <p className="text-muted">
            Not enough reviews yet. We show ratings once {MIN_REVIEWS_FOR_RATING} people have reviewed this company
            {count > 0 ? ` (${count} so far)` : ""}, so no single review can be picked out.
          </p>
        )}
      </div>

      {/* Nigeria questions */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Pay and benefits</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NIGERIA_QUESTIONS.map((q) => {
            const pct = stats?.[`${q.key}_yes_pct` as keyof CompanyStats] as number | null | undefined;
            const n = (stats?.[`${q.key}_answers` as keyof CompanyStats] as number | undefined) ?? 0;
            return (
              <li key={q.key} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
                {pct != null ? (
                  <>
                    <p className="font-semibold">
                      {q.stat}: {pct}% yes
                    </p>
                    <p className="text-sm text-muted">
                      From {n} {n === 1 ? "answer" : "answers"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">{q.stat}</p>
                    <p className="text-sm text-muted">Not enough answers yet (needs {MIN_ANSWERS_FOR_PERCENT}).</p>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Departments */}
      {departments.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">By department</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {departments.map((d) => (
              <li key={d.department} className="flex justify-between gap-3">
                <span>{isKey(DEPARTMENTS, d.department) ? DEPARTMENTS[d.department] : d.department}</span>
                <span>
                  <strong>{Number(d.avg_overall).toFixed(1)}</strong> <span className="text-muted">({d.review_count} reviews)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        count >= MIN_REVIEWS_FOR_RATING && (
          <p className="text-sm text-muted">Department ratings appear once a department has {MIN_REVIEWS_FOR_DEPARTMENT} reviews.</p>
        )
      )}

      {/* Salaries and interviews at a glance */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href={`${base}/salaries`} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 hover:border-primary">
          <span className="font-semibold">Salaries</span>
          <span className="text-sm text-muted">
            {salaries.length > 0
              ? `Pay ranges for ${salaries.length} ${salaries.length === 1 ? "role" : "roles"}`
              : counts.salaries > 0
                ? `${counts.salaries} ${counts.salaries === 1 ? "report" : "reports"}, not enough for any role yet`
                : "No salary reports yet"}
          </span>
        </Link>
        <Link href={`${base}/interviews`} className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 hover:border-primary">
          <span className="font-semibold">Interviews</span>
          <span className="text-sm text-muted">
            {interviews?.offer_pct != null
              ? `${interviews.offer_pct}% got an offer · ${interviews.report_count} reports`
              : counts.interviews > 0
                ? `${counts.interviews} ${counts.interviews === 1 ? "report" : "reports"}`
                : "No interview reports yet"}
          </span>
        </Link>
      </div>
    </div>
  );
}
