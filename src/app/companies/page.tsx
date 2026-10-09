import type { Metadata } from "next";
import Link from "next/link";
import { CompanyCard } from "@/components/CompanyCard";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/styles";
import { getUser } from "@/lib/auth";
import { COMPANIES_PER_PAGE, listCompanies } from "@/lib/company-data";
import { COMPANY_SORTS, INDUSTRIES, isKey } from "@/lib/companies";
import { NIGERIAN_STATES, stateLabel } from "@/lib/nigeria";
import { RequestCompanyForm } from "./RequestCompanyForm";

export const metadata: Metadata = { title: "Companies" };

type Params = { q?: string; industry?: string; state?: string; sort?: string; page?: string };

function pageHref(params: Params, page: number) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, page: page > 1 ? String(page) : undefined })) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `/companies?${s}` : "/companies";
}

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const raw = await searchParams;
  const q = (raw.q ?? "").trim().slice(0, 100);
  const industry = (INDUSTRIES as readonly string[]).includes(raw.industry ?? "") ? raw.industry : undefined;
  const state = (NIGERIAN_STATES as readonly string[]).includes(raw.state ?? "") ? raw.state : undefined;
  const sort = isKey(COMPANY_SORTS, raw.sort) ? raw.sort : "reviews";
  const page = Math.max(1, Math.floor(Number(raw.page) || 1));

  const { companies, total } = await listCompanies({ q, industry, state, sort, page });
  const pages = Math.max(1, Math.ceil(total / COMPANIES_PER_PAGE));
  const params: Params = { q: q || undefined, industry, state, sort: sort === "reviews" ? undefined : sort };
  const filtered = Boolean(q || industry || state);
  const user = companies.length === 0 && q ? await getUser() : null;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Companies</h1>
        <p className="text-muted">Find a company to see ratings, pay and benefits, and reviews from people who worked there.</p>
      </div>

      {/* key: remount on new params so "Clear" also clears the inputs. */}
      <form key={JSON.stringify(params)} method="get" role="search" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="font-medium">
            Search by name
          </label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="e.g. Harbour Bank" className={inputClass} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="industry" className="text-sm font-medium">
              Industry
            </label>
            <select id="industry" name="industry" defaultValue={industry ?? ""} className={inputClass}>
              <option value="">All industries</option>
              {INDUSTRIES.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="state" className="text-sm font-medium">
              State
            </label>
            <select id="state" name="state" defaultValue={state ?? ""} className={inputClass}>
              <option value="">All states</option>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {stateLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sort" className="text-sm font-medium">
              Sort by
            </label>
            <select id="sort" name="sort" defaultValue={sort} className={inputClass}>
              {Object.entries(COMPANY_SORTS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={buttonClass}>
            Search
          </button>
          {filtered && (
            <Link href="/companies" className={secondaryButtonClass}>
              Clear
            </Link>
          )}
        </div>
      </form>

      <p className="text-sm text-muted" aria-live="polite">
        {total === 0 ? "No companies found." : `${total} ${total === 1 ? "company" : "companies"}${filtered ? " found" : ""}`}
      </p>

      {companies.length > 0 && (
        <ul className="flex flex-col gap-3">
          {companies.map((c) => (
            <CompanyCard key={c.company_id} company={c} />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          {page > 1 ? (
            <Link href={pageHref(params, page - 1)} className={secondaryButtonClass} rel="prev">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted">
            Page {Math.min(page, pages)} of {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(params, page + 1)} className={secondaryButtonClass} rel="next">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      {companies.length === 0 && q && (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Can&apos;t find &ldquo;{q}&rdquo;?</h2>
          <p className="text-sm text-muted">Ask us to add it. We check every request before the company appears.</p>
          {user ? (
            <RequestCompanyForm initialName={q} />
          ) : (
            <Link href={`/login?next=${encodeURIComponent(pageHref(params, 1))}`} className={buttonClass}>
              Log in to request a company
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
