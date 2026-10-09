import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass, inputClass } from "@/components/styles";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Companies" };

export default async function AdminCompaniesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase } = await requireAdmin();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const { data, error } = await supabase.rpc("admin_companies", { p_query: q });
  if (error) throw new Error("Could not load companies");
  const companies = (data ?? []) as { id: string; name: string; slug: string; industry: string; status: string }[];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Companies</h1>
      <form method="get" className="flex flex-wrap gap-2">
        <label htmlFor="admin-company-q" className="sr-only">
          Search companies
        </label>
        <input id="admin-company-q" name="q" type="search" defaultValue={q} placeholder="Search by name" className={`${inputClass} max-w-sm`} />
        <button type="submit" className={buttonClass}>
          Search
        </button>
      </form>
      <ul className="flex flex-col gap-2">
        {companies.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/companies/${c.id}`} className="flex min-h-11 flex-col rounded-2xl border border-border bg-card p-3 hover:border-primary">
              <span className="font-semibold">{c.name}</span>
              <span className="text-sm text-muted">
                {c.industry} · {c.slug} · {c.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
