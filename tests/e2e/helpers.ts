import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

// Shared helpers for end-to-end tests. Need local Supabase running
// (Mailpit catches the auth emails).

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export async function emailLink(email: string, subject: string): Promise<string> {
  const query = `to:"${email}" subject:"${subject}"`;
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(query)}`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { HTML: string };
      const href = msg.HTML.match(/href="([^"]*\/auth\/confirm[^"]*)"/)?.[1];
      if (href) return href.replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Email "${subject}" not received`);
}

export const confirmationLink = (email: string) => emailLink(email, "Confirm your WorkEcho account");

export function newCredentials() {
  return { email: `e2e-${randomUUID()}@example.test`, password: `pw-${randomUUID().slice(0, 12)}` };
}

export async function fillLogin(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

/** Signs up, confirms the email and finishes onboarding. Ends on /me. */
export async function signUpAndOnboard(page: Page) {
  const creds = newCredentials();
  await page.goto("/signup");
  await page.getByLabel("Email").fill(creds.email);
  await page.getByLabel("Password").fill(creds.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto(await confirmationLink(creds.email));
  await page.goto("/onboarding?step=2");
  await page.getByLabel(/current employee/i).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page).toHaveURL(/\/me/);
  return creds;
}

/** Service-role client for test setup only (reads .env.local; never used by the app). */
export async function serviceClient() {
  const { readFileSync } = await import("node:fs");
  const { createClient } = await import("@supabase/supabase-js");
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

export async function makeAdmin(email: string) {
  const admin = await serviceClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error("user not found");
  const { error } = await admin.from("profiles").update({ is_admin: true }).eq("id", user.id);
  if (error) throw error;
}

export async function pseudonymOf(page: Page) {
  await page.goto("/me");
  return (await page.getByTestId("pseudonym").textContent())!.trim();
}
