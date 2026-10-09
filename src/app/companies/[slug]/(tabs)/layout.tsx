import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CompanyTabs } from "@/components/CompanyTabs";
import { getCompany, getCompanyCounts } from "@/lib/company-data";
import { stateLabel } from "@/lib/nigeria";

// Shared header and tabs: Overview | Reviews | Salaries | Interviews | Discussions.
export default async function CompanyTabsLayout({ params, children }: { params: Promise<{ slug: string }>; children: ReactNode }) {
  const { slug } = await params;
  const company = await getCompany(slug);
  if (!company) notFound();
  const counts = await getCompanyCounts(company.id);
  const base = `/companies/${slug}`;
  const place = [company.city, company.state ? stateLabel(company.state) : null].filter(Boolean).join(", ");

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Link href="/companies" className="-my-2 self-start py-2 text-sm font-medium text-primary underline">
          ← All companies
        </Link>
        <h1 className="text-2xl font-bold tracking-tight break-words md:text-3xl">{company.name}</h1>
        <p className="text-muted">
          {[company.industry, place, company.size_range ? `${company.size_range} staff` : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      <CompanyTabs
        tabs={[
          { href: base, label: "Overview" },
          { href: `${base}/reviews`, label: "Reviews", count: counts.reviews },
          { href: `${base}/salaries`, label: "Salaries", count: counts.salaries },
          { href: `${base}/interviews`, label: "Interviews", count: counts.interviews },
          { href: `${base}/discussions`, label: "Discussions" },
        ]}
      />
      {children}
    </section>
  );
}
