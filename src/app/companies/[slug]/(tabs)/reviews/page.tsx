import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/Notice";
import { ReportButton } from "@/components/ReportButton";
import { ReviewCard } from "@/components/ReviewCard";
import { buttonClass, secondaryButtonClass } from "@/components/styles";
import { getUser } from "@/lib/auth";
import { REVIEWS_PER_PAGE, getCompany, getCompanyStats, getMyReview, getMyVotes, getReviews } from "@/lib/company-data";
import { REVIEW_SORTS, isKey } from "@/lib/companies";
import { toggleHelpful } from "../../../actions";
import { ClearReviewDraft } from "./ClearReviewDraft";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string; page?: string; notice?: string; verified?: string }> };

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

export default async function CompanyReviewsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const company = await getCompany(slug);
  if (!company) notFound();

  const sort = isKey(REVIEW_SORTS, sp.sort) ? sp.sort : "newest";
  const page = Math.max(1, Math.floor(Number(sp.page) || 1));

  const verifiedOnly = sp.verified === "1";
  const [stats, reviews, user] = await Promise.all([getCompanyStats(company.id), getReviews(company.id, sort, page, verifiedOnly), getUser()]);
  const [myReview, myVotes] = user
    ? await Promise.all([getMyReview(company.id), getMyVotes(reviews.map((r) => r.id))])
    : [null, new Set<string>()];

  const count = stats?.review_count ?? 0;
  const verifiedCount = stats?.verified_review_count ?? 0;
  const href = ({ s = sort, v = verifiedOnly, p = 1 }: { s?: string; v?: boolean; p?: number }) => {
    const q = new URLSearchParams();
    if (s !== "newest") q.set("sort", s);
    if (v) q.set("verified", "1");
    if (p > 1) q.set("page", String(p));
    return `/companies/${slug}/reviews${q.size ? `?${q}` : ""}`;
  };
  const sortHref = (s: string) => href({ s });
  const pageHref = (p: number) => href({ p });
  const shownTotal = verifiedOnly ? verifiedCount : count;

  return (
    <div className="flex flex-col gap-4">
      {sp.notice === "review-submitted" && <ClearReviewDraft slug={slug} />}
      {sp.notice && NOTICES[sp.notice] && <Notice>{NOTICES[sp.notice]}</Notice>}
      <Link href={`/companies/${slug}/review`} className={`${buttonClass} self-start`}>
        {myReview ? "Edit your review" : "Write a review"}
      </Link>

      <div className="flex flex-col gap-3">
        <h2 className="sr-only">Reviews</h2>
        {count > 0 && (
          <p className="text-sm text-muted">
            {count} {count === 1 ? "review" : "reviews"} ({verifiedCount} verified). Verified reviews show first.
          </p>
        )}
        {count > 0 && (
          <Link
            href={href({ v: !verifiedOnly })}
            aria-pressed={verifiedOnly}
            className={`inline-flex min-h-11 items-center self-start rounded-full border px-4 text-sm font-medium ${
              verifiedOnly ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-primary-soft"
            }`}
          >
            ✓ Verified only
          </Link>
        )}
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
            <p className="font-medium">{page > 1 ? "No more reviews." : verifiedOnly ? "No verified reviews yet." : "No reviews yet."}</p>
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
                            <Link href={`/login?next=${encodeURIComponent(`/companies/${slug}/reviews`)}`} className="py-2 font-medium text-primary underline">
                              Log in to vote
                            </Link>
                          </>
                        )}
                        {!mine && <ReportButton type="review" id={r.id} signedIn={Boolean(user)} loginNext={`/companies/${slug}/reviews`} />}
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
            {reviews.length === REVIEWS_PER_PAGE && page * REVIEWS_PER_PAGE < shownTotal ? (
              <Link href={pageHref(page + 1)} className={secondaryButtonClass}>
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
