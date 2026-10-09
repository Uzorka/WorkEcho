import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass, dangerButtonClass, inputClass, secondaryButtonClass } from "@/components/styles";
import { requireAdmin } from "@/lib/admin";
import { AdminForm } from "../AdminForm";
import { approveRequest, resolveRequest } from "../actions";
import { CompanyFields } from "../CompanyFields";

export const metadata: Metadata = { title: "Company requests" };

type Request = {
  id: string;
  name: string;
  industry: string;
  state: string | null;
  website: string | null;
  status: string;
  created_at: string;
  similar_companies: { id: string; name: string; slug: string }[];
};

export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase } = await requireAdmin();
  const status = (await searchParams).status === "done" ? "done" : "pending";
  const { data, error } = await supabase.rpc("admin_company_requests", { p_status: status });
  if (error) throw new Error("Could not load requests");
  const requests = (data ?? []) as Request[];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Company requests</h1>
      <nav aria-label="Request status" className="flex gap-2">
        {(["pending", "done"] as const).map((s) => (
          <Link
            key={s}
            href={s === "pending" ? "/admin/requests" : "/admin/requests?status=done"}
            aria-current={status === s ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${status === s ? "border-primary bg-primary-soft text-primary" : "border-border"}`}
          >
            {s === "pending" ? "Waiting" : "Handled"}
          </Link>
        ))}
      </nav>
      {requests.length === 0 && <p className="rounded-2xl border border-border bg-card p-5 text-muted">Nothing here.</p>}
      <ul className="flex flex-col gap-4">
        {requests.map((r) => (
          <li key={r.id}>
            <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4" aria-label={`Request: ${r.name}`}>
              <header>
                <h2 className="text-lg font-semibold break-words">{r.name}</h2>
                <p className="text-sm text-muted">
                  {[r.industry, r.state, r.website, new Date(r.created_at).toLocaleDateString("en-NG"), status === "done" ? r.status : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </header>
              {r.similar_companies.length > 0 && (
                <p className="text-sm">
                  Similar existing companies:{" "}
                  {r.similar_companies.map((c, i) => (
                    <span key={c.id}>
                      {i > 0 && ", "}
                      <Link href={`/companies/${c.slug}`} className="text-primary underline">
                        {c.name}
                      </Link>{" "}
                      <code className="text-xs">({c.slug})</code>
                    </span>
                  ))}
                </p>
              )}
              {status === "pending" && (
                <>
                  <details className="rounded-xl border border-border p-3">
                    <summary className="min-h-11 cursor-pointer py-2 font-medium">Approve (check the details first)</summary>
                    <AdminForm action={approveRequest.bind(null, r.id)} noteLabel="Note for the log" className="mt-3">
                      <CompanyFields idPrefix={`req-${r.id}`} values={{ name: r.name, industry: r.industry, state: r.state, website: r.website }} />
                      <button type="submit" className={buttonClass}>
                        Approve and create company
                      </button>
                    </AdminForm>
                  </details>
                  <details className="rounded-xl border border-border p-3">
                    <summary className="min-h-11 cursor-pointer py-2 font-medium">Merge into an existing company</summary>
                    <AdminForm action={resolveRequest.bind(null, r.id, "merge")} noteLabel="Note for the log" className="mt-3">
                      <label className="flex w-full flex-col gap-1 text-sm font-medium">
                        Existing company slug
                        <input name="merge_slug" required defaultValue={r.similar_companies[0]?.slug ?? ""} className={inputClass} />
                      </label>
                      <button type="submit" className={secondaryButtonClass}>
                        Merge
                      </button>
                    </AdminForm>
                  </details>
                  <AdminForm action={resolveRequest.bind(null, r.id, "reject")} noteLabel="Reason (for the log)">
                    <button type="submit" className={dangerButtonClass}>
                      Reject
                    </button>
                  </AdminForm>
                </>
              )}
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
