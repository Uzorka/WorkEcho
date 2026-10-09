import type { Metadata } from "next";
import { dangerButtonClass, inputClass, buttonClass } from "@/components/styles";
import { requireAdmin } from "@/lib/admin";
import { AdminForm } from "../AdminForm";
import { revokeVerification } from "../actions";

export const metadata: Metadata = { title: "Verifications" };

type Row = { id: string; pseudonym: string; company_name: string; company_slug: string; verified_at: string; expires_at: string; status: string };

// Admins can see and REVOKE checkmarks. There is no way to grant one here (CLAUDE.md rule 10).
export default async function AdminVerificationsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase } = await requireAdmin();
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const { data, error } = await supabase.rpc("admin_verifications", { p_query: q });
  if (error) throw new Error("Could not load verifications");
  const rows = (data ?? []) as Row[];
  const date = (iso: string) => new Date(iso).toLocaleDateString("en-NG");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Verifications</h1>
      <p className="text-sm text-muted">
        Checkmarks are earned only by passing work-email verification. Admins can revoke them (logged), never grant them. Banning a user revokes
        theirs automatically.
      </p>
      <form method="get" className="flex flex-wrap gap-2">
        <label htmlFor="admin-ver-q" className="sr-only">
          Search by pseudonym or company
        </label>
        <input id="admin-ver-q" name="q" type="search" defaultValue={q} placeholder="Pseudonym or company" className={`${inputClass} max-w-sm`} />
        <button type="submit" className={buttonClass}>
          Search
        </button>
      </form>
      {rows.length === 0 && <p className="rounded-2xl border border-border bg-card p-5 text-muted">No verifications found.</p>}
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.id}>
            <article className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4" aria-label={`Verification ${r.pseudonym}`}>
              <p className="font-semibold break-all">
                {r.pseudonym} <span className="font-normal text-muted">at {r.company_name}</span>
              </p>
              <p className="text-sm text-muted">
                Status: <strong data-testid="verification-status">{r.status}</strong> · verified {date(r.verified_at)} · expires {date(r.expires_at)}
              </p>
              {r.status !== "revoked" && (
                <AdminForm action={revokeVerification.bind(null, r.id)} noteLabel="Reason (for the log)">
                  <button type="submit" className={dangerButtonClass}>
                    Revoke checkmark
                  </button>
                </AdminForm>
              )}
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
