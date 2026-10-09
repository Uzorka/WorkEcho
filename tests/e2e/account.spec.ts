import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

// Full account flow against a real local Supabase:
// sign up -> confirm email (via Mailpit) -> onboarding -> /me -> log out -> log in.
// Needs `npm run db:start` (Mailpit captures the confirmation email).

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

async function emailLink(email: string, subject: string): Promise<string> {
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

const confirmationLink = (email: string) => emailLink(email, "Confirm your WorkEcho account");

async function fillLogin(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("sign up, onboard, view /me, log out and log back in", async ({ page }) => {
  test.setTimeout(90_000);
  const email = `e2e-${randomUUID()}@example.test`;
  const password = `pw-${randomUUID().slice(0, 12)}`;

  // Sign up
  await page.goto("/signup");
  await expect(page.getByText(/use a personal email, not your work email/i).first()).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  // Must agree to Terms + Privacy first.
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Please agree to the Terms and Privacy Policy.")).toBeVisible();
  // Passwords are never sent back to the page, so it has to be typed again.
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  // Can't log in before confirming.
  await page.goto("/login");
  await fillLogin(page, email, password);
  await expect(page.getByText(/confirm your email first/i)).toBeVisible();

  // Confirm email -> lands on onboarding step 1.
  await page.goto(await confirmationLink(email));
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByText("Step 1 of 3")).toBeVisible();
  await expect(page.getByText(/what you write can still reveal you/i)).toBeVisible();

  // Unfinished onboarding: other pages send you back.
  await page.goto("/me");
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("link", { name: "Continue" }).click();

  // Step 2: who are you
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Choose the option that fits you best.")).toBeVisible();
  await page.getByLabel(/former employee/i).check();
  await page.getByLabel(/state/i).selectOption("Lagos");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3: pseudonym, back button, regenerate
  await expect(page.getByText("Step 3 of 3")).toBeVisible();
  await page.getByRole("link", { name: /back/i }).click();
  await expect(page.getByText("Step 2 of 3")).toBeVisible();
  await expect(page.getByLabel(/former employee/i)).toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();

  const pseudonym = page.getByTestId("pseudonym");
  const first = (await pseudonym.textContent())!.trim();
  expect(first).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{2}$/);
  await page.getByRole("button", { name: /give me another \(3 changes left\)/i }).click();
  await expect(page.getByRole("button", { name: /2 changes left/i })).toBeVisible();
  const chosen = (await pseudonym.textContent())!.trim();
  expect(chosen).not.toBe(first);
  await page.getByRole("button", { name: "Finish" }).click();

  // /me
  await expect(page).toHaveURL(/\/me/);
  await expect(page.getByRole("heading", { level: 1, name: "Me" })).toBeVisible();
  await expect(page.getByTestId("pseudonym")).toHaveText(chosen);
  await expect(page.getByText("Former employee")).toBeVisible();
  await expect(page.getByText("Lagos")).toBeVisible();
  await expect(page.getByText(/Deleted user/)).toBeVisible();

  // Onboarding is done: can't go back to it.
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/me$/);

  // Log out
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\?notice=signed-out/);
  await expect(page.getByText("You've signed out.")).toBeVisible();
  await page.goto("/me");
  await expect(page).toHaveURL(/\/login\?next=%2Fme/);

  // Wrong password, then log in -> back to /me
  await fillLogin(page, email, "wrong-password");
  await expect(page.getByText("That email and password don't match.")).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/me$/);
  await expect(page.getByTestId("pseudonym")).toHaveText(chosen);
});

test("reset a forgotten password, then delete the account", async ({ page }) => {
  test.setTimeout(90_000);
  const email = `e2e-${randomUUID()}@example.test`;
  const password = `pw-${randomUUID().slice(0, 12)}`;
  const newPassword = `new-${randomUUID().slice(0, 12)}`;

  // Quick sign-up and onboarding.
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto(await confirmationLink(email));
  await page.goto("/onboarding?step=2");
  await page.getByLabel(/job seeker/i).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Finish" }).click();
  await expect(page).toHaveURL(/\/me/);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  // Forgot password
  await page.getByRole("link", { name: /forgot your password/i }).click();
  await expect(page.getByRole("heading", { name: /forgot your password/i })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/if an account uses that email/i)).toBeVisible();
  await page.goto(await emailLink(email, "Reset your WorkEcho password"));
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel("New password").fill(newPassword);
  await page.getByLabel("Type it again").fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page).toHaveURL(/\/me\?notice=password-updated/);

  // Log in with the new password
  await page.getByRole("button", { name: "Sign out" }).click();
  await fillLogin(page, email, newPassword);
  await expect(page).toHaveURL(/\/$/);

  // Delete the account: needs DELETE typed exactly
  await page.goto("/me");
  await page.getByLabel("Type DELETE to confirm").fill("delete");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page.getByText(/type DELETE in capital letters/i)).toBeVisible();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await expect(page).toHaveURL(/\/login\?notice=account-deleted/);
  await expect(page.getByText("Your account has been deleted.")).toBeVisible();

  // The account is gone.
  await fillLogin(page, email, newPassword);
  await expect(page.getByText("That email and password don't match.")).toBeVisible();
});
