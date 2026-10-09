import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set. Start Supabase and fill in .env.local first.`);
  return v;
}

const url = () => env("NEXT_PUBLIC_SUPABASE_URL");
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export const anonClient = () => createClient(url(), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), opts);
export const adminClient = () => createClient(url(), env("SUPABASE_SERVICE_ROLE_KEY"), opts);

export type TestUser = { id: string; email: string; client: SupabaseClient };

/** Creates a confirmed user and returns a client signed in as them. */
export async function createTestUser(admin: SupabaseClient): Promise<TestUser> {
  const email = `test-${randomUUID()}@example.test`;
  const password = `pw-${randomUUID()}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const client = anonClient();
  const signedIn = await client.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  return { id: created.data.user.id, email, client };
}

export async function deleteTestUser(admin: SupabaseClient, user?: TestUser) {
  if (user) await admin.auth.admin.deleteUser(user.id);
}

/** A confirmed user who has finished onboarding (can write reviews). */
export async function createContributor(admin: SupabaseClient): Promise<TestUser> {
  const { ensureProfile } = await import("@/lib/profile-service");
  const user = await createTestUser(admin);
  await ensureProfile(admin, user.id);
  const { error } = await admin
    .from("profiles")
    .update({ user_type: "current_employee", onboarded_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) throw error;
  return user;
}

export async function createTestCompany(admin: SupabaseClient, status: "active" | "pending" = "active") {
  const slug = `test-co-${randomUUID().slice(0, 8)}`;
  const { data, error } = await admin
    .from("companies")
    .insert({ name: `Test Company ${slug}`, slug, industry: "Other", state: "Lagos", status })
    .select("id, slug, name")
    .single();
  if (error) throw error;
  return data as { id: string; slug: string; name: string };
}

export function reviewInput(companyId: string, overrides: Record<string, unknown> = {}) {
  return {
    company_id: companyId,
    employment_status: "current",
    employment_type: "full_time",
    rating_overall: 4,
    rating_pay: 3,
    rating_work_life: 4,
    rating_management: 3,
    rating_culture: 4,
    rating_growth: 3,
    salary_on_time: "yes",
    headline: "Test review headline",
    pros: "Test pros, long enough to pass the check.",
    cons: "Test cons, long enough to pass the check.",
    ...overrides,
  };
}
