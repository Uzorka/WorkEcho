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
