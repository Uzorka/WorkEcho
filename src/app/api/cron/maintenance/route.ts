import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

// Daily data clean-up, called by Vercel Cron (see vercel.json).
// Deletes or unlinks data past its retention period; see run_maintenance().
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"), serverEnv().CRON_SECRET)) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const { data, error } = await createAdminClient().rpc("run_maintenance");
  if (error) return NextResponse.json({ error: "Clean-up failed" }, { status: 500 });
  // Counts only — no ids or content.
  return NextResponse.json({ ok: true, ...(data as Record<string, number>) });
}
