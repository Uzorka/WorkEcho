import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/Notice";
import { ReportButton } from "@/components/ReportButton";
import { VerifiedLabel } from "@/components/ReviewCard";
import { buttonClass, secondaryButtonClass } from "@/components/styles";
import { getUser } from "@/lib/auth";
import { INTERVIEWS_PER_PAGE, getCompany, getInterviewStats, getInterviews, getMyInterview } from "@/lib/company-data";
import {
  DEPARTMENTS,
  INTERVIEW_EXPERIENCES,
  INTERVIEW_OUTCOMES,
  INTERVIEW_STAGES,
  MIN_REPORTS_FOR_INTERVIEW_SUMMARY,
  isKey,
} from "@/lib/companies";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ notice?: string; page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await getCompany((await params).slug);
  return { title: company ? `${company.name} interviews` : "Company not found" };
}

const NOTICES: Record<string, string> = {
  "interview-submitted": "Thanks! Your interview report will appear within 72 hours. We add a random delay so the timing can't point to you.",
  "interview-updated": "Your changes are saved.",
  "interview-deleted": "Your interview report has been deleted.",
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-border bg-card p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-xl font-bold">{value}</dd>
    </div>
  );
}

export default async function CompanyInterviewsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const company = await getCompany(slug);
  if (!company) notFound();
  const page = Math.max(1, Math.floor(Number(sp.page) || 1));

  const [stats, reports, user] = await Promise.all([getInterviewStats(company.id), getInterviews(company.id, page), getUser()]);
  const mine = user ? await getMyInterview(company.id) : null;
  const total = stats?.report_count ?? 0;
  const pageHref = (p: number) => `/companies/${slug}/interviews${p > 1 ? `?page=${p}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      {sp.notice && NOTICES[sp.notice] && <Notice>{NOTICES[sp.notice]}</Notice>}
      <Link href={`/companies/${slug}/interview`} className={`${buttonClass} self-start`}>
        {mine ? "Edit your interview" : "Share your interview"}
      </Link>

      <h2 className="text-lg font-semibold">Summary</h2>
      {stats?.offer_pct != null ? (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Got an offer" value={`${stats.offer_pct}%`} />
          <Stat label="Ghosted" value={`${stats.ghosted_pct}%`} />
          <Stat label="Average process" value={stats.avg_weeks != null ? `${Number(stats.avg_weeks).toFixed(1)} weeks` : "Not enough data"} />
          <Stat label="Average difficulty" value={`${Number(stats.avg_difficulty).toFixed(1)} / 5`} />
        </dl>
      ) : (
        <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted">
          Not enough interview reports yet. The summary appears once {MIN_REPORTS_FOR_INTERVIEW_SUMMARY} people have shared
          {total > 0 ? ` (${total} so far)` : ""}.
        </p>
      )}

      <h2 className="text-lg font-semibold">Interview reports</h2>
      {reports.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-medium">{page > 1 ? "No more reports." : "No interview reports yet."}</p>
          <p className="mt-1 text-sm text-muted">Interviewed here? Share what they asked. It helps the next person prepare.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => (
            <li key={r.id}>
              <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold">
                    {isKey(DEPARTMENTS, r.role_group) ? DEPARTMENTS[r.role_group] : r.role_group} interview
                  </h3>
                  {r.is_verified && <VerifiedLabel />}
                  <p className="text-sm text-muted">
                    {[
                      isKey(INTERVIEW_OUTCOMES, r.outcome) ? INTERVIEW_OUTCOMES[r.outcome] : r.outcome,
                      `Difficulty ${r.difficulty}/5`,
                      r.process_weeks != null ? `${r.process_weeks} ${r.process_weeks === 1 ? "week" : "weeks"}` : null,
                      isKey(INTERVIEW_EXPERIENCES, r.experience) ? `${INTERVIEW_EXPERIENCES[r.experience]} experience` : null,
                      r.published_quarter,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {r.stages.length > 0 && (
                  <ul className="flex flex-wrap gap-2 text-xs" aria-label="Stages">
                    {r.stages.map((s) => (
                      <li key={s} className="rounded-full bg-primary-soft px-3 py-1">
                        {isKey(INTERVIEW_STAGES, s) ? INTERVIEW_STAGES[s] : s}
                      </li>
                    ))}
                  </ul>
                )}
                <div>
                  <h4 className="text-sm font-semibold">What they asked</h4>
                  <p className="whitespace-pre-line break-words">{r.questions_asked}</p>
                </div>
                {r.tips && (
                  <div>
                    <h4 className="text-sm font-semibold">Tips</h4>
                    <p className="whitespace-pre-line break-words">{r.tips}</p>
                  </div>
                )}
                <div className="-mx-2 -mb-2 flex flex-wrap border-t border-border pt-1">
                  <ReportButton type="interview" id={r.id} signedIn={Boolean(user)} loginNext={`/companies/${slug}/interviews`} />
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {(page > 1 || page * INTERVIEWS_PER_PAGE < total) && (
        <nav aria-label="Interview pages" className="flex justify-between gap-3">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={secondaryButtonClass}>
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          {page * INTERVIEWS_PER_PAGE < total ? (
            <Link href={pageHref(page + 1)} className={secondaryButtonClass}>
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
