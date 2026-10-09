import Link from "next/link";
import { requireAdmin } from "@/lib/admin";

export default async function AdminHome() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.rpc("admin_counts").single();
  const counts = (data ?? { open_reports: 0, pending_requests: 0, banned_users: 0 }) as Record<string, number>;
  const card = "flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 hover:border-primary";
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Admin</h1>
      <p className="text-sm text-muted">Every action here is logged with your pseudonym. Be fair: remove what breaks the rules, not what&apos;s merely negative.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/admin/reports" className={card}>
          <span className="text-2xl font-bold">{counts.open_reports}</span>
          <span className="text-sm text-muted">Items with open reports</span>
        </Link>
        <Link href="/admin/requests" className={card}>
          <span className="text-2xl font-bold">{counts.pending_requests}</span>
          <span className="text-sm text-muted">Company requests waiting</span>
        </Link>
        <Link href="/admin/users" className={card}>
          <span className="text-2xl font-bold">{counts.banned_users}</span>
          <span className="text-sm text-muted">Banned accounts</span>
        </Link>
      </div>
    </div>
  );
}
