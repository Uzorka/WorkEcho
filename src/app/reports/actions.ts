"use server";

import { z } from "zod";
import { getUser } from "@/lib/auth";
import { DEPARTMENTS, SALARY_LEVELS } from "@/lib/companies";
import { REPORT_CONTENT_TYPES, REPORT_REASONS } from "@/lib/report-reasons";
import { createClient } from "@/lib/supabase/server";

export type ReportResult = { ok: boolean; message: string };

const schema = z.object({
  type: z.enum(REPORT_CONTENT_TYPES),
  id: z.uuid(),
  reason: z.enum(Object.keys(REPORT_REASONS) as [keyof typeof REPORT_REASONS], { message: "Choose a reason." }),
  details: z.string().trim().max(1000, { message: "Keep details under 1,000 characters." }).optional(),
  roleGroup: z.enum(Object.keys(DEPARTMENTS) as [string]).optional(),
  level: z.enum(Object.keys(SALARY_LEVELS) as [string]).optional(),
});

export async function reportContent(input: z.input<typeof schema>): Promise<ReportResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check your report." };
  if (!(await getUser())) return { ok: false, message: "Please log in to report." };

  const { type, id, reason, details, roleGroup, level } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_content", {
    p_type: type,
    p_id: id,
    p_reason: reason,
    p_details: details || null,
    p_role_group: roleGroup ?? null,
    p_level: level ?? null,
  });
  if (error) {
    if (error.code === "P0429") return { ok: false, message: error.message };
    if (error.code === "42501") return { ok: false, message: "You can't send reports right now." };
    return { ok: false, message: "We couldn't send your report. Please try again." };
  }
  switch ((data as { status: string }).status) {
    case "reported":
      return { ok: true, message: "Thanks. Our moderators will take a look. Nobody else can see who reported it." };
    case "already_reported":
      return { ok: true, message: "You've already reported this. Thanks — it's in our queue." };
    case "own":
      return { ok: false, message: "You can't report your own content. You can edit or delete it instead." };
    case "not_found":
      return { ok: false, message: "This is no longer available." };
    default:
      return { ok: false, message: "Please check your report and try again." };
  }
}
