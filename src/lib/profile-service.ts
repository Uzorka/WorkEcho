import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_PSEUDONYM_REGENERATIONS, generateUniquePseudonym } from "./pseudonym";

// Profile writes that users may not do themselves (pseudonym assignment).
// Every function takes the SERVICE-ROLE client, so callers must be server-only
// and must pass the id of the already-authenticated user — never an id from
// the request body.

export type OwnProfile = {
  pseudonym: string;
  user_type: "current_employee" | "former_employee" | "job_seeker" | null;
  state: string | null;
  pseudonym_regenerations: number;
  onboarded_at: string | null;
  is_banned?: boolean;
};

const OWN_PROFILE_COLUMNS = "pseudonym, user_type, state, pseudonym_regenerations, onboarded_at";
const UNIQUE_VIOLATION = "23505";
const MAX_RACE_RETRIES = 5;

async function pseudonymTaken(admin: SupabaseClient, candidate: string): Promise<boolean> {
  // ilike without wildcards = case-insensitive equality (pseudonyms are [A-Za-z0-9] only).
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .ilike("pseudonym", candidate);
  if (error) throw new Error("Could not check pseudonym");
  return (count ?? 0) > 0;
}

/** Creates the user's profile with a fresh pseudonym if it doesn't exist yet. */
export async function ensureProfile(admin: SupabaseClient, userId: string): Promise<OwnProfile> {
  for (let i = 0; i < MAX_RACE_RETRIES; i++) {
    const existing = await admin.from("profiles").select(OWN_PROFILE_COLUMNS).eq("id", userId).maybeSingle();
    if (existing.error) throw new Error("Could not load profile");
    if (existing.data) return existing.data as OwnProfile;

    const pseudonym = await generateUniquePseudonym((c) => pseudonymTaken(admin, c));
    const inserted = await admin
      .from("profiles")
      .insert({ id: userId, pseudonym })
      .select(OWN_PROFILE_COLUMNS)
      .single();
    if (!inserted.error) return inserted.data as OwnProfile;
    // Someone grabbed the same pseudonym, or a parallel request created the
    // profile first. Loop: re-read, and try again with a new name if needed.
    if (inserted.error.code !== UNIQUE_VIOLATION) throw new Error("Could not create profile");
  }
  throw new Error("Could not create profile");
}

export type RegenerateResult =
  | { ok: true; profile: OwnProfile }
  | { ok: false; reason: "limit" | "onboarded" | "missing" };

/** Gives the user a new pseudonym. Allowed only before onboarding is finished, at most 3 times. */
export async function regeneratePseudonym(admin: SupabaseClient, userId: string): Promise<RegenerateResult> {
  for (let i = 0; i < MAX_RACE_RETRIES; i++) {
    const current = await admin.from("profiles").select(OWN_PROFILE_COLUMNS).eq("id", userId).maybeSingle();
    if (current.error) throw new Error("Could not load profile");
    const profile = current.data as OwnProfile | null;
    if (!profile) return { ok: false, reason: "missing" };
    if (profile.onboarded_at) return { ok: false, reason: "onboarded" };
    if (profile.pseudonym_regenerations >= MAX_PSEUDONYM_REGENERATIONS) return { ok: false, reason: "limit" };

    const pseudonym = await generateUniquePseudonym((c) => pseudonymTaken(admin, c), {
      exclude: [profile.pseudonym],
    });
    // Conditional update: only applies if nothing changed since we read the row,
    // so two parallel clicks can't both spend the same regeneration.
    const updated = await admin
      .from("profiles")
      .update({ pseudonym, pseudonym_regenerations: profile.pseudonym_regenerations + 1 })
      .eq("id", userId)
      .eq("pseudonym_regenerations", profile.pseudonym_regenerations)
      .is("onboarded_at", null)
      .select(OWN_PROFILE_COLUMNS)
      .maybeSingle();
    if (updated.error && updated.error.code !== UNIQUE_VIOLATION) throw new Error("Could not update pseudonym");
    if (updated.data) return { ok: true, profile: updated.data as OwnProfile };
    // Lost a race (or the name was just taken): re-read and decide again.
  }
  throw new Error("Could not update pseudonym");
}
