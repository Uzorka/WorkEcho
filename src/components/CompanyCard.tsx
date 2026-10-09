import Link from "next/link";
import type { CompanyStats } from "@/lib/company-data";
import { stateLabel } from "@/lib/nigeria";
import { Stars } from "./Stars";

export function CompanyCard({ company }: { company: CompanyStats }) {
  const place = [company.city, company.state ? stateLabel(company.state) : null].filter(Boolean).join(", ");
  return (
    <li>
      <Link
        href={`/companies/${company.slug}`}
        // Don't prefetch every company on the page: saves mobile data.
        prefetch={false}
        className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 hover:border-primary"
      >
        <span className="text-lg font-semibold">{company.name}</span>
        <span className="text-sm text-muted">{[company.industry, place].filter(Boolean).join(" · ")}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
          {company.avg_overall !== null ? <Stars value={company.avg_overall} /> : <span className="text-muted">Not enough reviews yet</span>}
          <span className="text-muted">
            {company.review_count} {company.review_count === 1 ? "review" : "reviews"}
          </span>
        </span>
      </Link>
    </li>
  );
}
