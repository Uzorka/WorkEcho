"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { INDUSTRIES, SIZE_RANGES } from "@/lib/companies";
import { NIGERIAN_STATES } from "@/lib/nigeria";
import { REPORT_CONTENT_TYPES } from "@/lib/report-reasons";

// Admin actions. Each one checks admin status here AND in the database
// function it calls (which also writes the admin_actions log).

export type AdminResult = { ok: boolean; message: string };

const note = (fd: FormData) => String(fd.get("note") ?? "").trim().slice(0, 1000) || null;
const fail = (message = "That didn't work. Please try again."): AdminResult => ({ ok: false, message });

/** One form, several buttons: the clicked button's name="action" value decides. */
export async function moderate(type: string, key: string, _prev: AdminResult | null, fd: FormData): Promise<AdminResult> {
  const { supabase } = await requireAdmin();
  const action = String(fd.get("action") ?? "");
  if (!(REPORT_CONTENT_TYPES as readonly string[]).includes(type) || !["dismiss", "hide", "remove", "restore"].includes(action)) return fail();
  const { error } = await supabase.rpc("admin_moderate", { p_type: type, p_key: key, p_action: action, p_note: note(fd) });
  if (error) return fail();
  revalidatePath("/", "layout");
  return { ok: true, message: `Done: ${action}.` };
}

export async function moderateSalary(salaryId: string, action: string, _prev: AdminResult | null, fd: FormData): Promise<AdminResult> {
  const { supabase } = await requireAdmin();
  if (!["hide", "remove", "restore"].includes(action)) return fail();
  const { error } = await supabase.rpc("admin_moderate_salary", { p_salary_id: salaryId, p_action: action, p_note: note(fd) });
  if (error) return fail();
  revalidatePath("/", "layout");
  return { ok: true, message: `Salary report: ${action}.` };
}

const companySchema = z.object({
  name: z.string().trim().min(2, { message: "Enter a name." }).max(120),
  industry: z.enum(INDUSTRIES, { message: "Choose an industry." }),
  state: z.union([z.literal(""), z.enum(NIGERIAN_STATES)]),
  city: z.string().trim().max(80),
  website: z.union([z.literal(""), z.string().trim().regex(/^https?:\/\/\S+$/, { message: "Website must start with http:// or https://" }).max(200)]),
  size_range: z.union([z.literal(""), z.enum(SIZE_RANGES)]),
  description: z.string().trim().max(2000),
});

function companyFields(fd: FormData) {
  return companySchema.safeParse({
    name: fd.get("name") ?? "",
    industry: fd.get("industry") ?? "",
    state: fd.get("state") ?? "",
    city: fd.get("city") ?? "",
    website: fd.get("website") ?? "",
    size_range: fd.get("size_range") ?? "",
    description: fd.get("description") ?? "",
  });
}

export async function approveRequest(requestId: string, _prev: AdminResult | null, fd: FormData): Promise<AdminResult> {
  const { supabase } = await requireAdmin();
  const parsed = companyFields(fd);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const c = parsed.data;
  const { data, error } = await supabase.rpc("admin_approve_request", {
    p_request_id: requestId,
    p_name: c.name,
    p_industry: c.industry,
    p_state: c.state,
    p_city: c.city,
    p_website: c.website,
    p_size_range: c.size_range,
    p_description: c.description,
    p_note: note(fd),
  });
  if (error) return fail(error.code === "P0002" ? "This request was already handled." : undefined);
  revalidatePath("/admin", "layout");
  revalidatePath("/companies");
  return { ok: true, message: `Approved. The company is live at /companies/${data}.` };
}

export async function resolveRequest(requestId: string, action: "merge" | "reject", _prev: AdminResult | null, fd: FormData): Promise<AdminResult> {
  const { supabase } = await requireAdmin();
  let companyId: string | null = null;
  if (action === "merge") {
    const slug = String(fd.get("merge_slug") ?? "").trim();
    const { data } = await supabase.from("companies").select("id").eq("slug", slug).maybeSingle();
    if (!data) return fail("No active company has that slug.");
    companyId = data.id as string;
  }
  const { error } = await supabase.rpc("admin_resolve_request", { p_request_id: requestId, p_action: action, p_company_id: companyId, p_note: note(fd) });
  if (error) return fail(error.code === "P0002" ? "This request was already handled." : undefined);
  revalidatePath("/admin", "layout");
  return { ok: true, message: action === "merge" ? "Merged into the existing company." : "Rejected." };
}

export async function updateCompany(companyId: string, _prev: AdminResult | null, fd: FormData): Promise<AdminResult> {
  const { supabase } = await requireAdmin();
  const parsed = companyFields(fd);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const status = fd.get("status") === "pending" ? "pending" : "active";
  const c = parsed.data;
  const { error } = await supabase.rpc("admin_update_company", {
    p_id: companyId,
    p_name: c.name,
    p_industry: c.industry,
    p_state: c.state,
    p_city: c.city,
    p_website: c.website,
    p_size_range: c.size_range,
    p_description: c.description,
    p_status: status,
    p_note: note(fd),
  });
  if (error) return fail();
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

export async function setUser(userId: string, _prev: AdminResult | null, fd: FormData): Promise<AdminResult> {
  const { supabase } = await requireAdmin();
  const action = String(fd.get("action") ?? "");
  if (!["warn", "ban", "unban"].includes(action)) return fail();
  if (action === "warn" && !note(fd)) return fail("Write the warning the user will see.");
  const { error } = await supabase.rpc("admin_set_user", { p_user_id: userId, p_action: action, p_note: note(fd) });
  if (error) return fail(error.code === "42501" ? "Admins can't be banned here." : undefined);
  revalidatePath("/admin/users");
  return { ok: true, message: action === "warn" ? "Warning sent." : action === "ban" ? "Banned. They can read but not write." : "Unbanned." };
}

/** Only for banned accounts, to enforce the ban. Logged in admin_actions by the database. */
export async function revealBannedEmail(userId: string): Promise<AdminResult> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_banned_user_email", { p_user_id: userId });
  if (error) return fail("Email is only available for banned accounts.");
  return { ok: true, message: data as string };
}

