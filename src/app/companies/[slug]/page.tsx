import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/Notice";
import { ReviewCard } from "@/components/ReviewCard";
import { Stars } from "@/components/Stars";
import { buttonClass, secondaryButtonClass } from "@/components/styles";
import { getUser } from "@/lib/auth";
import {
  REVIEWS_PER_PAGE,
  getCompany,
  getCompanyStats,
  getDepartmentStats,
  getMyReview,
  getMyVotes,
  getReviews,
  type CompanyStats,
} from "@/lib/company-data";
import {
  DEPARTMENTS,
  MIN_ANSWERS_FOR_PERCENT,
  MIN_REVIEWS_FOR_DEPARTMENT,
  MIN_REVIEWS_FOR_RATING,
  NIGERIA_QUESTIONS,
  RATING_CATEGORIES,
  REVIEW_SORTS,
  isKey,
} from "@/lib/companies";
import { stateLabel } from "@/lib/nigeria";
import { toggleHelpful } from "../actions";
import { ClearReviewDraft } from "./ClearReviewDraft";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string; page?: string; notice?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await getCompany((await params).slug);
  return { title: company ? `${company.name} reviews` : "Company not found" };
}

const NOTICES: Record<string, string> = {
  "review-submitted":
    "Thanks! Your review will appear within 72 hours. We add a random delay so the timing can't point to you.",
  "review-updated": "Your changes are saved.",
  "review-deleted": "Your review has been deleted.",
};

export default async function CompanyPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const company = await getCompany(slug);
  if (!company) notFound();

  const sort = isKey(REVIEW_SORTS, sp.sort) ? sp.sort : "newest";
  const page = Math.max(1, Math.floor(Number(sp.page) || 1));

  const [stats, departments, reviews, user] = await Promise.all([
    getCompanyStats(company.id),
    getDepartmentStats(company.id),
    getReviews(company.id, sort, page),
    getUser(),
  ]);
  const [myReview, myVotes] = user
    ? await Promise.all([getMyReview(company.id), getMyVotes(reviews.map((r) => r.id))])
    : [null, new Set<string>()];

  const count = stats?.review_count ?? 0;
  const place = [company.city, company.state ? stateLabel(company.state) : null].filter(Boolean).join(", ");
  const sortHref = (s: string) => `/companies/${slug}${s === "newest" ? "" : `?sort=${s}`}`;
  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (sort !== "newest") q.set("sort", sort);
    if (p > 1) q.set("page", String(p));
    return `/companies/${slug}${q.size ? `?${q}` : ""}`;
  };

  return (
    <section className="flex flex-col gap-6">
      {sp.notice === "review-submitted" && <ClearReviewDraft slug={slug} />}
      {sp.notice && NOTICES[sp.notice] && <Notice>{NOTICES[sp.notice]}</Notice>}

      {/* Overview */}
      <div className="flex flex-col gap-3">
        <Link href="/companies" className="-my-2 self-start py-2 text-sm font-medium text-primary underline">
          ← All companies
        </Link>
        <h1 className="text-2xl font-bold tracking-tight break-words md:text-3xl">{company.name}</h1>
        <p className="text-muted">
          {[company.industry, place, company.size_range ? `${company.size_range} staff` : null].filter(Boolean).join(" · ")}
        </p>
        {company.description && <p>{company.description}</p>}
        {company.website && (
          <a href={company.website} rel="nofollow noopener noreferrer" target="_blank" className="self-start py-2 text-sm font-medium text-primary underline">
            Company website
          </a>
        )}
        <Link href={`/companies/${slug}/review`} className={`${buttonClass} self-start`}>
          {myReview ? "Edit your review" : "Write a review"}
        </Link>
      </div>

      {/* Ratings */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Ratings</h2>
        {stats?.avg_overall != null ? (
          <>
            <div className="flex flex-col gap-1">
              <Stars value={stats.avg_overall} size="lg" />
              <p className="text-sm text-muted">
                Overall, from {count} {count === 1 ? "review" : "reviews"}
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
          <p className="text-sm text-muted">
            Department ratings appear once a department has {MIN_REVIEWS_FOR_DEPARTMENT} reviews.
          </p>
        )
      )}

      {/* Reviews */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Reviews</h2>
        {count > 0 && (
          <nav aria-label="Sort reviews" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {Object.entries(REVIEW_SORTS).map(([key, label]) => (
              <Link
                key={key}
                href={sortHref(key)}
                aria-current={sort === key ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium ${
                  sort === key ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-primary-soft"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}

        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-medium">{page > 1 ? "No more reviews." : "No reviews yet."}</p>
            <p className="mt-1 text-sm text-muted">
              Worked here? Your review helps job seekers decide. New reviews appear within 72 hours.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {reviews.map((r) => {
              const mine = myReview?.id === r.id;
              const voted = myVotes.has(r.id);
              return (
                <li key={r.id}>
                  <ReviewCard
                    review={r}
                    footer={
                      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-sm">
                        {mine ? (
                          <span className="text-muted">Your review · {r.helpful_count} found it helpful</span>
                        ) : user ? (
                          <form action={toggleHelpful.bind(null, slug, r.id)}>
                            <button
                              type="submit"
                              aria-pressed={voted}
                              className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-medium ${
                                voted ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-primary-soft"
                              }`}
                            >
                              Helpful ({r.helpful_count})
                            </button>
                          </form>
                        ) : (
                          <>
                            <span className="text-muted">{r.helpful_count} found this helpful</span>
                            <Link href={`/login?next=${encodeURIComponent(`/companies/${slug}`)}`} className="py-2 font-medium text-primary underline">
                              Log in to vote
                            </Link>
                          </>
                        )}
                      </div>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}

        {(page > 1 || reviews.length === REVIEWS_PER_PAGE) && (
          <nav aria-label="Review pages" className="flex justify-between gap-3">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className={secondaryButtonClass}>
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            {reviews.length === REVIEWS_PER_PAGE && page * REVIEWS_PER_PAGE < count ? (
              <Link href={pageHref(page + 1)} className={secondaryButtonClass}>
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </section>
  );
}
