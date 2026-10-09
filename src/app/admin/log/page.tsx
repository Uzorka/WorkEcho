import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Action log" };

type Entry = { id: string; admin_pseudonym: string; action: string; target_type: string; target_id: string; note: string | null; created_at: string };

export default async function AdminLogPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_action_log");
  if (error) throw new Error("Could not load the log");
  const entries = (data ?? []) as Entry[];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Action log</h1>
      <p className="text-sm text-muted">Every admin action and automatic hide, newest first (last 200).</p>
      {entries.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-muted">No actions yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">When</th>
                <th scope="col" className="px-3 py-2 font-medium">Who</th>
                <th scope="col" className="px-3 py-2 font-medium">What</th>
                <th scope="col" className="px-3 py-2 font-medium">Target</th>
                <th scope="col" className="px-3 py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border align-top last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap">{new Date(e.created_at).toLocaleString("en-NG")}</td>
                  <td className="px-3 py-2">{e.admin_pseudonym}</td>
                  <td className="px-3 py-2">{e.action.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2">
                    {e.target_type} <code className="text-xs break-all">{e.target_id}</code>
                  </td>
                  <td className="px-3 py-2 break-words">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
