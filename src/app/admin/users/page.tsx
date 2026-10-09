import type { Metadata } from "next";
import { buttonClass, dangerButtonClass, inputClass, secondaryButtonClass } from "@/components/styles";
import { accountAge, requireAdmin } from "@/lib/admin";
import { USER_TYPE_LABELS } from "@/lib/account-constants";
import { uuidSchema } from "@/lib/post-schema";
import { AdminForm } from "../AdminForm";
import { setUser } from "../actions";
import { RevealEmail } from "./RevealEmail";

export const metadata: Metadata = { title: "Users" };

type AdminUser = {
  id: string;
  pseudonym: string;
  user_type: keyof typeof USER_TYPE_LABELS | null;
  created_at: string;
  is_admin: boolean;
  is_banned: boolean;
  warnings: number;
  posts: number;
  reviews: number;
  reports_against: number;
};

// Pseudonym and account age only. No emails (except to enforce a ban).
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; id?: string }> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const id = sp.id && uuidSchema.safeParse(sp.id).success ? sp.id : null;
  const { data, error } = await supabase.rpc("admin_users", { p_query: q, p_id: id });
  if (error) throw new Error("Could not load users");
  const users = (data ?? []) as AdminUser[];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Users</h1>
      <form method="get" className="flex flex-wrap gap-2">
        <label htmlFor="admin-user-q" className="sr-only">
          Search by pseudonym
        </label>
        <input id="admin-user-q" name="q" type="search" defaultValue={q} placeholder="Search by pseudonym" className={`${inputClass} max-w-sm`} />
        <button type="submit" className={buttonClass}>
          Search
        </button>
      </form>
      {users.length === 0 && <p className="rounded-2xl border border-border bg-card p-5 text-muted">No users found.</p>}
      <ul className="flex flex-col gap-3">
        {users.map((u) => (
          <li key={u.id}>
            <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4" aria-label={`User ${u.pseudonym}`}>
              <header className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold break-all">{u.pseudonym}</h2>
                {u.is_admin && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold">Admin</span>}
                {u.is_banned && <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-white">Banned</span>}
              </header>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted">Account age</dt>
                  <dd>{accountAge(u.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Type</dt>
                  <dd>{u.user_type ? USER_TYPE_LABELS[u.user_type] : "Not set"}</dd>
                </div>
                <div>
                  <dt className="text-muted">Warnings</dt>
                  <dd>{u.warnings}</dd>
                </div>
                <div>
                  <dt className="text-muted">Posts</dt>
                  <dd>{u.posts}</dd>
                </div>
                <div>
                  <dt className="text-muted">Reviews</dt>
                  <dd>{u.reviews}</dd>
                </div>
                <div>
                  <dt className="text-muted">Reports against</dt>
                  <dd>{u.reports_against}</dd>
                </div>
              </dl>
              {!u.is_admin && (
                <AdminForm action={setUser.bind(null, u.id)} noteLabel="Message (required for a warning; shown to the user) / note for the log">
                  <button type="submit" name="action" value="warn" className={secondaryButtonClass}>
                    Warn
                  </button>
                  {u.is_banned ? (
                    <button type="submit" name="action" value="unban" className={secondaryButtonClass}>
                      Unban
                    </button>
                  ) : (
                    <button type="submit" name="action" value="ban" className={dangerButtonClass}>
                      Ban
                    </button>
                  )}
                </AdminForm>
              )}
              {u.is_banned && <RevealEmail userId={u.id} />}
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
