import type { Metadata } from "next";
import Link from "next/link";
import { dangerButtonClass, secondaryButtonClass } from "@/components/styles";
import { requireAdmin } from "@/lib/admin";
import { DEPARTMENTS, SALARY_LEVELS, formatNaira, isKey } from "@/lib/companies";
import { REPORT_REASONS, isReportReason } from "@/lib/report-reasons";
import { AdminForm } from "../AdminForm";
import { moderate, moderateSalary } from "../actions";

export const metadata: Metadata = { title: "Reports" };

type QueueItem = {
  content_type: string;
  content_key: string;
  content_id: string;
  context: { role_group?: string; level?: string } | null;
  content_status: string;
  preview: string | null;
  company_name: string | null;
  company_slug: string | null;
  author_id: string | null;
  author_pseudonym: string | null;
  report_count: number;
  open_count: number;
  reasons: string[];
  details: string[];
  reporters: string[];
  last_reported: string;
};

const TYPE_LABELS: Record<string, string> = { post: "Post", reply: "Reply", review: "Review", interview: "Interview report", salary_group: "Salary group" };

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase } = await requireAdmin();
  const status = (await searchParams).status === "closed" ? "closed" : "open";
  const { data, error } = await supabase.rpc("admin_reports_queue", { p_status: status });
  if (error) throw new Error("Could not load reports");
  const items = (data ?? []) as QueueItem[];

  const salaryGroups = await Promise.all(
    items
      .filter((i) => i.content_type === "salary_group" && i.context?.role_group && i.context.level)
      .map(async (i) => {
        const { data: rows } = await supabase.rpc("admin_salary_group", {
          p_company_id: i.content_id,
          p_role_group: i.context!.role_group,
          p_level: i.context!.level,
        });
        return [i.content_key, (rows ?? []) as { id: string; monthly_gross_naira: number; status: string; author_pseudonym: string }[]] as const;
      }),
  );
  const salaries = new Map(salaryGroups);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Reports</h1>
      <nav aria-label="Report status" className="flex gap-2">
        {(["open", "closed"] as const).map((s) => (
          <Link
            key={s}
            href={s === "open" ? "/admin/reports" : "/admin/reports?status=closed"}
            aria-current={status === s ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${status === s ? "border-primary bg-primary-soft text-primary" : "border-border"}`}
          >
            {s === "open" ? "Open" : "Closed"}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-5 text-muted">{status === "open" ? "No open reports. 🎉" : "No closed reports yet."}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => {
            const key = `${item.content_type}:${item.content_key}`;
            const isSalary = item.content_type === "salary_group";
            return (
              <li key={key}>
                <article className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4" aria-label={`${TYPE_LABELS[item.content_type]} report`}>
                  <header className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-primary-soft px-3 py-1 font-semibold">{TYPE_LABELS[item.content_type]}</span>
                    <span>
                      Status: <strong data-testid="content-status">{item.content_status}</strong>
                    </span>
                    <span className="text-muted">
                      · {item.open_count} open / {item.report_count} total reports
                    </span>
                    {item.company_name && item.company_slug && (
                      <Link href={`/companies/${item.company_slug}`} className="text-primary underline">
                        {item.company_name}
                      </Link>
                    )}
                    {item.content_type === "post" && (
                      <Link href={`/posts/${item.content_id}`} className="text-primary underline">
                        Open post
                      </Link>
                    )}
                  </header>

                  {isSalary ? (
                    <p className="font-medium">
                      {isKey(DEPARTMENTS, item.context?.role_group) ? DEPARTMENTS[item.context!.role_group] : item.context?.role_group} /{" "}
                      {isKey(SALARY_LEVELS, item.context?.level) ? SALARY_LEVELS[item.context!.level] : item.context?.level}
                    </p>
                  ) : (
                    <blockquote className="border-l-4 border-border pl-3 whitespace-pre-line break-words">{item.preview}</blockquote>
                  )}

                  {item.author_pseudonym && (
                    <p className="text-sm">
                      Author:{" "}
                      <Link href={`/admin/users?id=${item.author_id}`} className="font-medium text-primary underline">
                        {item.author_pseudonym}
                      </Link>
                    </p>
                  )}

                  <div className="text-sm">
                    <p>
                      <span className="font-medium">Reasons:</span>{" "}
                      {item.reasons.map((r) => (isReportReason(r) ? REPORT_REASONS[r] : r)).join(", ")}
                    </p>
                    {item.details.length > 0 && (
                      <ul className="mt-1 list-disc pl-5">
                        {item.details.map((d, i) => (
                          <li key={i} className="break-words">
                            {d}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1 text-muted">Reported by (admins only): {item.reporters.join(", ")}</p>
                  </div>

                  {isSalary && (
                    <table className="w-full text-left text-sm">
                      <caption className="text-left font-medium">Individual salaries in this group (admins only)</caption>
                      <tbody>
                        {(salaries.get(item.content_key) ?? []).map((s) => (
                          <tr key={s.id} className="border-t border-border align-top">
                            <td className="py-2 pr-2 font-semibold whitespace-nowrap">{formatNaira(s.monthly_gross_naira)}</td>
                            <td className="py-2 pr-2">{s.status}</td>
                            <td className="py-2 pr-2 text-muted">{s.author_pseudonym}</td>
                            <td className="py-2">
                              <AdminForm action={moderateSalary.bind(null, s.id, s.status === "published" ? "hide" : "restore")}>
                                <button type="submit" className={secondaryButtonClass}>
                                  {s.status === "published" ? "Hide" : "Restore"}
                                </button>
                              </AdminForm>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <div className="border-t border-border pt-3">
                    <AdminForm action={moderate.bind(null, item.content_type, item.content_key)} noteLabel="Note for the log">
                      <button type="submit" name="action" value="dismiss" className={secondaryButtonClass}>
                        Dismiss reports
                      </button>
                      {!isSalary && (
                        <>
                          <button type="submit" name="action" value="hide" className={secondaryButtonClass}>
                            Hide
                          </button>
                          <button type="submit" name="action" value="remove" className={dangerButtonClass}>
                            Remove
                          </button>
                          <button type="submit" name="action" value="restore" className={secondaryButtonClass}>
                            Restore
                          </button>
                        </>
                      )}
                    </AdminForm>
                    <p className="mt-2 text-xs text-muted">
                      Dismiss closes the reports (and un-hides an auto-hidden item). Hide keeps it for review; Remove takes it down for good.
                    </p>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
