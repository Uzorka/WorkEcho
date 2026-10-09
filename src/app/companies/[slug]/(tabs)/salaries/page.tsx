import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/Notice";
import { ReportButton } from "@/components/ReportButton";
import { buttonClass } from "@/components/styles";
import { getUser } from "@/lib/auth";
import { getCompany, getCompanyCounts, getMySalary, getSalaryStats } from "@/lib/company-data";
import { DEPARTMENTS, MIN_REPORTS_FOR_SALARY, SALARY_LEVELS, formatNaira, isKey } from "@/lib/companies";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ notice?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const company = await getCompany((await params).slug);
  return { title: company ? `${company.name} salaries` : "Company not found" };
}

const NOTICES: Record<string, string> = {
  "salary-submitted": "Thanks! Your salary will be counted within 72 hours. We add a random delay so the timing can't point to you.",
  "salary-updated": "Your changes are saved.",
  "salary-deleted": "Your salary report has been deleted.",
};

export default async function CompanySalariesPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { notice } = await searchParams;
  const company = await getCompany(slug);
  if (!company) notFound();

  const [groups, counts, user] = await Promise.all([getSalaryStats(company.id), getCompanyCounts(company.id), getUser()]);
  const mine = user ? await getMySalary(company.id) : null;

  return (
    <div className="flex flex-col gap-4">
      {notice && NOTICES[notice] && <Notice>{NOTICES[notice]}</Notice>}
      <Link href={`/companies/${slug}/salary`} className={`${buttonClass} self-start`}>
        {mine ? "Edit your salary" : "Add your salary"}
      </Link>
      <h2 className="text-lg font-semibold">Monthly gross pay</h2>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-medium">Not enough salary data yet.</p>
          <p className="mt-1 text-sm text-muted">
            We show pay for a role and level once {MIN_REPORTS_FOR_SALARY} people have reported it, so no one&apos;s salary can be
            picked out.{counts.salaries > 0 ? ` ${counts.salaries} ${counts.salaries === 1 ? "report" : "reports"} so far.` : ""}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Monthly gross pay by role and level at {company.name}</caption>
              <thead className="border-b border-border text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Role and level
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Median
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Range
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Reports
                  </th>
                  <th scope="col" className="px-2 py-3">
                    <span className="sr-only">Report a problem</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={`${g.role_group}-${g.level}`} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-3 font-medium">
                      {isKey(DEPARTMENTS, g.role_group) ? DEPARTMENTS[g.role_group] : g.role_group}
                      <span className="block font-normal text-muted">{isKey(SALARY_LEVELS, g.level) ? SALARY_LEVELS[g.level] : g.level}</span>
                    </th>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{formatNaira(g.median_naira)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatNaira(g.lowest_naira)} – {formatNaira(g.highest_naira)}
                    </td>
                    <td className="px-4 py-3 text-right">{g.report_count}</td>
                    <td className="px-2 py-1">
                      <ReportButton
                        type="salary_group"
                        id={company.id}
                        roleGroup={g.role_group}
                        level={g.level}
                        signedIn={Boolean(user)}
                        loginNext={`/companies/${slug}/salaries`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted">
            Amounts are monthly gross pay, rounded to the nearest ₦10,000. Roles with fewer than {MIN_REPORTS_FOR_SALARY} reports
            aren&apos;t shown.
          </p>
        </>
      )}
    </div>
  );
}
