import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { makeAdmin, pseudonymOf, signUpAndOnboard } from "./helpers";

// Slice 6: work-email verification against local Supabase + Mailpit.
const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const DOMAIN = "harbour-demo.test";

async function latestCode(to: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}" subject:"Your verification code"`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages.length) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string; From: { Name: string } };
      expect(msg.From.Name).toBe("WorkEcho");
      return msg.Text.match(/\b(\d{6})\b/)![1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("No verification email");
}

/** Count occurrences of `needle` in the whole database and in Supabase's service logs (not the Mailpit inbox). */
function findEverywhere(needle: string) {
  const dump = execFileSync("docker", ["exec", "supabase_db_workecho", "pg_dump", "-U", "postgres", "--data-only", "postgres"], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
  });
  const containers = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" })
    .split("\n")
    .filter((n) => n.startsWith("supabase_") && !n.includes("inbucket"));
  const logs = containers.map((c) => execFileSync("docker", ["logs", c], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 512 * 1024 * 1024 })).join("\n");
  // Optional: the Next.js server log, when the server was started with output to this file.
  const appLog = process.env.APP_LOG_FILE && existsSync(process.env.APP_LOG_FILE) ? readFileSync(process.env.APP_LOG_FILE, "utf8") : "";
  return { db: dump.split(needle).length - 1, logs: logs.split(needle).length - 1, app: appLog.split(needle).length - 1 };
}

test("verify with a work email, earn a checkmark, admin revokes it", async ({ page, browser }) => {
  test.setTimeout(240_000);

  // An admin sets the company's work-email domain (the only admin power here besides revoking).
  const modCtx = await browser.newContext();
  const mod = await modCtx.newPage();
  await makeAdmin((await signUpAndOnboard(mod)).email);
  await mod.goto("/admin/companies?q=Harbour");
  await mod.getByRole("link", { name: /Demo Harbour Bank/ }).click();
  const domains = mod.getByLabel("Work email domains (for verification)");
  await domains.fill("gmail.com");
  await mod.getByRole("button", { name: "Save changes" }).click();
  await expect(mod.getByText(/"gmail.com" is a free email provider/)).toBeVisible();
  await domains.fill(DOMAIN);
  await mod.getByRole("button", { name: "Save changes" }).click();
  await expect(mod.getByText("Saved.")).toBeVisible();

  // A user verifies.
  await signUpAndOnboard(page);
  const pseudonym = await pseudonymOf(page);
  await page.getByRole("link", { name: "Get verified" }).click();
  await expect(page).toHaveURL(/\/me\/verify$/);
  await page.getByLabel("Company", { exact: true }).selectOption({ label: "Demo Harbour Bank" });
  const email = page.getByLabel("Work email");
  const tick = page.getByRole("checkbox", { name: /may record that WorkEcho sent you an email/ });
  const send = page.getByRole("button", { name: "Send my code" });

  await email.fill("ada@gmail.com");
  await tick.check();
  await send.click();
  await expect(page.getByText(/not a free email address/)).toBeVisible();

  await page.getByLabel("Work email").fill("ada@other-company.test");
  await page.getByRole("checkbox", { name: /may record/ }).check();
  await page.getByRole("button", { name: "Send my code" }).click();
  await expect(page.getByText(`Use your Demo Harbour Bank work email (ending in @${DOMAIN}).`)).toBeVisible();

  const workEmail = `ada.${randomUUID().slice(0, 8)}@${DOMAIN}`;
  await page.getByLabel("Work email").fill(workEmail);
  await page.getByRole("button", { name: "Send my code" }).click();
  await expect(page.getByText("Please tick the box to continue.")).toBeVisible();
  await page.getByLabel("Work email").fill(workEmail);
  await page.getByRole("checkbox", { name: /may record/ }).check();
  await page.getByRole("button", { name: "Send my code" }).click();
  await expect(page.getByText(/We sent a 6-digit code to a•••@harbour-demo\.test for Demo Harbour Bank/)).toBeVisible();

  const code = await latestCode(workEmail);
  await page.getByLabel("Verification code").fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("That code isn't right. 4 tries left.")).toBeVisible();
  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify" }).click();

  await expect(page).toHaveURL(/\/me\?notice=verified/);
  await expect(page.getByText(/You're verified!/)).toBeVisible();
  const badge = page.getByRole("button", { name: "Verified worker. What does this mean?" });
  await expect(badge).toBeVisible();
  await badge.click();
  const sheet = page.getByRole("dialog", { name: "Verified worker" });
  await expect(sheet).toContainText("Checkmarks are earned through verification and can never be bought.");
  await expect(sheet).not.toContainText("Demo Harbour Bank");
  await expect(page.getByRole("list", { name: "Your verifications" })).toContainText("Demo Harbour Bank");

  // The work email was never saved anywhere (database, Supabase logs, app log).
  expect(findEverywhere(workEmail)).toEqual({ db: 0, logs: 0, app: 0 });

  // The checkmark shows on the user's posts, without the company.
  await page.goto("/create?type=post");
  await page.getByLabel("Category").selectOption("general");
  await page.getByLabel("Your post").fill("Checking out the checkmark.");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page).toHaveURL(/\/posts\//);
  const article = page.getByRole("article").first();
  await expect(article.getByRole("button", { name: "Verified worker. What does this mean?" })).toBeVisible();
  await expect(article).not.toContainText("Demo Harbour Bank");

  // The admin revokes it (there is no button to grant one).
  await mod.goto(`/admin/verifications?q=${encodeURIComponent(pseudonym)}`);
  const row = mod.getByRole("article", { name: `Verification ${pseudonym}` });
  await expect(row).toBeVisible();
  await expect(mod.getByRole("button", { name: /grant|give|add checkmark/i })).toHaveCount(0);
  await row.getByLabel(/Reason/).fill("Test revoke");
  await row.getByRole("button", { name: "Revoke checkmark" }).click();
  await expect(row.getByTestId("verification-status")).toHaveText("revoked");
  await expect(row.getByRole("button", { name: "Revoke checkmark" })).toHaveCount(0);

  await page.goto("/me");
  await expect(page.getByRole("button", { name: "Verified worker. What does this mean?" })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Your verifications" })).toContainText("Removed by moderators");
  await modCtx.close();
});

test("public page explains checkmarks", async ({ page }) => {
  await page.goto("/verification");
  await expect(page.getByRole("heading", { level: 1, name: "How checkmarks work" })).toBeVisible();
  await expect(page.getByText(/can never be bought/).first()).toBeVisible();
  await page.goto("/me/verify");
  await expect(page).toHaveURL(/\/login\?next=%2Fme%2Fverify/);
});
