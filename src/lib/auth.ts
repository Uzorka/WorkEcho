import "server-only";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile, type OwnProfile } from "@/lib/profile-service";

/** The signed-in user, verified with the auth server (not just the cookie). */
export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** For pages and server actions that need a signed-in user. */
export async function requireUser(next = "/") {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** The signed-in user's own profile, read through RLS as that user. */
export async function getMyProfile(): Promise<OwnProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("pseudonym, user_type, state, pseudonym_regenerations, onboarded_at, is_banned")
    .maybeSingle();
  return (data as OwnProfile | null) ?? null;
}

/** Returns the profile, creating it (with a server-generated pseudonym) on first use. */
export async function getOrCreateMyProfile(userId: string): Promise<OwnProfile> {
  return (await getMyProfile()) ?? ensureProfile(createAdminClient(), userId);
}
