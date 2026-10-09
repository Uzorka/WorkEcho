import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "./auth";

/**
 * Every /admin page and admin action calls this first. Non-admins (and
 * logged-out visitors) get a plain 404, so the area isn't even confirmed to
 * exist. The database functions check is_admin() again on every call.
 */
export async function requireAdmin() {
  const user = await getUser();
  if (!user) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin");
  if (error || data !== true) notFound();
  return { user, supabase };
}

export function accountAge(iso: string, now = Date.now()) {
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000);
  if (days < 1) return "less than a day";
  if (days < 60) return `${days} ${days === 1 ? "day" : "days"}`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} months`;
  return `${Math.floor(days / 365)} years`;
}
