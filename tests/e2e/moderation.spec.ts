import { expect, test } from "@playwright/test";
import { makeAdmin, pseudonymOf, signUpAndOnboard } from "./helpers";

const ADMIN_PAGES = ["/admin", "/admin/reports", "/admin/requests", "/admin/companies", "/admin/users", "/admin/log", "/admin/companies/00000000-0000-4000-8000-000000000001"];

test("non-admins can't see any admin page", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  await signUpAndOnboard(page);
  for (const path of ADMIN_PAGES) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { name: /couldn.t find that page/i })).toBeVisible();
  }
});

test("draft legal pages", async ({ page }) => {
  for (const [path, heading] of [["/guidelines", "Community guidelines"], ["/privacy", "Privacy policy"], ["/terms", "Terms of use"]]) {
    await page.goto(path);
    await expect(page.getByText("DRAFT — pending legal review")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  await page.goto("/privacy");
  await expect(page.getByText(/Nigeria Data Protection Act 2023/)).toBeVisible();
  await page.goto("/terms");
  await expect(page.getByRole("link", { name: /takedown@/ })).toBeVisible();
});

test("privacy warning while writing, and the server blocks phone numbers", async ({ page }) => {
  test.setTimeout(90_000);
  await signUpAndOnboard(page);
  await page.goto("/create?type=post");
  await page.getByLabel("Category").selectOption("general");
  const body = page.getByLabel("Your post");

  await body.fill("My staff ID: HB10234 and salary account 0123456789 are on the letter.");
  const warning = page.getByRole("status").filter({ hasText: "This could identify you" });
  await expect(warning).toBeVisible();
  await expect(warning.locator("mark")).toHaveText(["staff ID: HB10234", "0123456789"]);
  await expect(warning.getByText(/This check isn.t perfect/)).toBeVisible();

  await body.fill("Text me on 0803 123 4567 for details");
  await expect(page.getByText("Remove phone numbers and email addresses before posting.")).toBeVisible();
  await expect(page.getByRole("status").locator("mark")).toHaveText("0803 123 4567");
  // The server refuses it too.
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText(/Please remove phone numbers and email addresses/).first()).toBeVisible();
  await expect(page).toHaveURL(/\/create/);

  // Editing it away clears the warning.
  await body.fill("Ask me here instead.");
  await expect(page.getByText("Remove phone numbers and email addresses before posting.")).toHaveCount(0);
});

test("rate limit: a friendly message after 5 posts in an hour", async ({ page }) => {
  test.setTimeout(150_000);
  await signUpAndOnboard(page);
  for (let i = 1; i <= 6; i++) {
    await page.goto("/create?type=post");
    await page.getByLabel("Category").selectOption("general");
    await page.getByLabel("Your post").fill(`Rate limit check number ${i}`);
    await page.getByRole("button", { name: "Post", exact: true }).click();
    if (i <= 5) await expect(page).toHaveURL(/\/posts\//);
  }
  await expect(page.getByText("You can write up to 5 posts an hour. Please try again a bit later.")).toBeVisible();
});

test("report → admin queue → remove; warn and ban a user", async ({ page, browser }) => {
  test.setTimeout(240_000);

  // Author writes a post.
  const author = await signUpAndOnboard(page);
  const authorName = await pseudonymOf(page);
  await page.goto("/create?type=post");
  await page.getByLabel("Category").selectOption("management");
  const text = `Moderation e2e ${Date.now()}: my manager is the worst person here`;
  await page.getByLabel("Your post").fill(text);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page).toHaveURL(/\/posts\//);
  const postUrl = page.url();
  await expect(page.getByRole("button", { name: "Report" })).toHaveCount(0); // not on your own post

  // A reader reports it.
  const readerCtx = await browser.newContext();
  const reader = await readerCtx.newPage();
  await signUpAndOnboard(reader);
  await reader.goto(postUrl);
  await reader.getByRole("button", { name: "Report" }).click();
  await reader.getByRole("button", { name: "Send report" }).click();
  await expect(reader.getByText("Choose a reason.")).toBeVisible();
  await reader.getByLabel("Names an individual").check();
  await reader.getByLabel(/More details/).fill("Talks about a specific manager");
  await reader.getByRole("button", { name: "Send report" }).click();
  await expect(reader.getByText(/Thanks\. Our moderators will take a look/)).toBeVisible();
  const readerName = await pseudonymOf(reader);

  // A moderator handles it.
  const modCtx = await browser.newContext();
  const mod = await modCtx.newPage();
  const modCreds = await signUpAndOnboard(mod);
  await makeAdmin(modCreds.email);
  await mod.goto("/me");
  await mod.getByRole("link", { name: "Open the admin area" }).click();
  await expect(mod.getByRole("heading", { name: "Admin" })).toBeVisible();
  await mod.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Reports" }).click();
  const item = mod.getByRole("article").filter({ hasText: text });
  await expect(item).toBeVisible();
  await expect(item.getByText(/Reasons:.*Names an individual/)).toBeVisible();
  await expect(item.getByText("Talks about a specific manager")).toBeVisible();
  await expect(item.getByText(`Reported by (admins only): ${readerName}`)).toBeVisible();
  await expect(item.getByRole("link", { name: authorName })).toBeVisible();
  await item.getByLabel(/Note for the log/).fill("Names a manager");
  await item.getByRole("button", { name: "Remove" }).click();
  // Handled: it leaves the open queue and shows as removed under Closed.
  await expect(item).toHaveCount(0);
  await mod.getByRole("link", { name: "Closed" }).click();
  await expect(mod.getByRole("article").filter({ hasText: text }).getByTestId("content-status")).toHaveText("removed");
  expect((await reader.goto(postUrl))?.status()).toBe(404);

  // The action is in the log.
  await mod.goto("/admin/log");
  await expect(mod.getByRole("row").filter({ hasText: "moderate remove" }).filter({ hasText: "Names a manager" }).first()).toBeVisible();

  // Warn, then ban the author. Admins see pseudonym and account age, not email.
  await mod.goto(`/admin/users?q=${encodeURIComponent(authorName)}`);
  const user = mod.getByRole("article", { name: `User ${authorName}` });
  await expect(user.getByText("Account age")).toBeVisible();
  await expect(mod.getByText(author.email)).toHaveCount(0);
  await user.getByLabel(/Message/).fill("Please review the company, not named people.");
  await user.getByRole("button", { name: "Warn" }).click();
  await expect(user.getByText("Warning sent.")).toBeVisible();
  await user.getByRole("button", { name: "Ban" }).click();
  await expect(user.getByText(/Banned\. They can read but not write\./)).toBeVisible();
  await mod.reload();
  await user.getByRole("button", { name: "Show email to enforce ban (logged)" }).click();
  await expect(user.getByText(`Email: ${author.email}`)).toBeVisible();

  // The author sees the warning, and can read but not post.
  await page.goto("/alerts");
  await expect(page.getByText("A moderator sent you a warning")).toBeVisible();
  await expect(page.getByText("Please review the company, not named people.")).toBeVisible();
  await page.goto("/create?type=post");
  await expect(page.getByText("Your account is suspended.")).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("main").getByRole("article").first()).toBeVisible();

  await readerCtx.close();
  await modCtx.close();
});
