import { expect, test, type Page } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

// Uses the 14 fictional demo posts in supabase/seed.sql (run `npm run db:reset`).

const posts = (page: Page) => page.getByRole("main").getByRole("article");

test("logged-out visitors read the feed: tabs, filters, load more, post page", async ({ page }) => {
  await page.goto("/home");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: /know the company/i })).toBeVisible();

  // First page of 10, then "Load more" adds the rest with no duplicates.
  await expect(posts(page)).toHaveCount(10);
  // Keep loading until the end (earlier test runs may have added posts).
  for (let i = 0; i < 20 && (await page.getByRole("button", { name: /Load more|Loading/ }).count()); i++) {
    const before = await posts(page).count();
    await page.getByRole("button", { name: "Load more" }).click();
    await expect(posts(page)).not.toHaveCount(before);
  }
  await expect(page.getByText("You're all caught up.")).toBeVisible();
  const count = await posts(page).count();
  expect(count).toBeGreaterThanOrEqual(14);
  // No post appears twice (each card links to its own /posts/<id>).
  const links = await posts(page).getByRole("link", { name: /^\d+ repl(y|ies)$/ }).evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  expect(links).toHaveLength(count);
  expect(new Set(links).size).toBe(count);

  // Post card: pseudonym, avatar, company tag, like (log in), reply count, share, report (soon).
  const first = posts(page).filter({ hasText: "13th month" });
  await expect(first.getByText(/^DemoReviewer\d+$/)).toBeVisible();
  await expect(first.getByRole("link", { name: "Demo Harbour Bank", exact: true })).toHaveAttribute("href", "/companies/demo-harbour-bank");
  await expect(first.getByRole("link", { name: /Log in to like\. 3 likes/ })).toBeVisible();
  await expect(first.getByRole("link", { name: "2 replies" })).toBeVisible();
  await expect(first.getByRole("button", { name: /Report/ })).toBeDisabled();

  // Top this week: the most-liked post first.
  await page.getByRole("link", { name: "Top this week" }).click();
  await expect(page).toHaveURL(/sort=top/);
  await expect(posts(page).first()).toContainText("13th month");

  // Category chips.
  await page.getByRole("navigation", { name: "Filter by category" }).getByRole("link", { name: "Job Offers" }).click();
  await expect(page).toHaveURL(/category=job_offers/);
  await expect(posts(page)).toHaveCount(2);

  // Post page with replies.
  await page.goto("/");
  await posts(page).filter({ hasText: "13th month" }).getByRole("link", { name: /13th month/ }).click();
  await expect(page).toHaveURL(/\/posts\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "Replies (2)" })).toBeVisible();
  await expect(page.getByText("(Demo reply) It came with the December salary when I was there.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in to reply" })).toBeVisible();

  // Company Discussions tab shows posts tagged to it.
  await page.goto("/companies/demo-harbour-bank/discussions");
  await expect(posts(page)).toHaveCount(1);
  await expect(posts(page)).toContainText("13th month");

  expect((await page.goto("/posts/00000000-0000-4000-8000-000000000999"))?.status()).toBe(404);
});

test("post, like, reply, get an alert, edit and delete", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await signUpAndOnboard(page);

  // A writes a post tagged to a company, from the Create button.
  await page.goto("/create");
  await page.getByRole("link", { name: /Write a post/ }).click();
  await page.getByLabel("Category").selectOption("career_advice");
  await page.getByLabel(/Company/).fill("weav");
  await page.getByRole("button", { name: "Demo Weaver Software" }).click();
  await expect(page.getByText("Demo Weaver Software")).toBeVisible();
  const body = page.getByLabel("Your post");
  await body.fill("x".repeat(1001));
  await expect(page.getByText(/1,001 \/ 1,000 — 1 too many/)).toBeVisible();
  await body.fill("Call me on 0803 123 4567 to talk about tech jobs");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText(/remove phone numbers and email addresses/)).toBeVisible();
  await expect(page.getByLabel("Category")).toHaveValue("career_advice");
  const text = `E2E post ${Date.now()}: how do you move from support into a tech role?`;
  await body.fill(text);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page).toHaveURL(/\/posts\/[0-9a-f-]+$/);
  const postUrl = page.url();
  await expect(page.getByText(text)).toBeVisible();
  await expect(page.getByText("(you)")).toBeVisible();
  await expect(page.getByRole("link", { name: "Demo Weaver Software" })).toBeVisible();

  // It's on the home feed (Latest) and the company's Discussions tab.
  await page.goto("/");
  await expect(posts(page).first()).toContainText(text);
  await page.goto("/companies/demo-weaver-software/discussions");
  await expect(posts(page).first()).toContainText(text);

  // B (another browser) likes and replies.
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await signUpAndOnboard(pageB);
  await pageB.goto(postUrl);
  const like = pageB.getByRole("button", { name: /^Like\./ });
  await expect(like).toHaveAccessibleName("Like. 0 likes");
  // Wait for the save to finish before reloading.
  await Promise.all([
    pageB.waitForResponse((r) => r.request().method() === "POST" && Boolean(r.request().headers()["next-action"])),
    like.click(),
  ]);
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toHaveAccessibleName("Like. 1 like");
  await pageB.reload();
  await expect(pageB.getByRole("button", { name: /^Like\./ })).toHaveAccessibleName("Like. 1 like");
  // B sees Report, not Edit/Delete.
  await expect(pageB.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(pageB.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await pageB.getByLabel("Write a reply").fill("Start with a short course and build one small project.");
  await pageB.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(pageB.getByText("Reply posted.")).toBeVisible();
  await expect(pageB.getByRole("heading", { name: "Replies (1)" })).toBeVisible();
  await expect(pageB.getByLabel("Write a reply")).toHaveValue("");
  await ctxB.close();

  // A gets an alert.
  await page.goto("/");
  const alertsLink = page.getByRole("navigation", { name: "Main" }).filter({ visible: true }).getByRole("link", { name: /Alerts/ });
  await expect(alertsLink).toHaveAccessibleName("Alerts, 1 unread");
  await alertsLink.click();
  await expect(page.getByText("1 unread")).toBeVisible();
  await expect(page.getByRole("button", { name: /Someone replied to your post/ })).toBeVisible();
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByText("You're all caught up.")).toBeVisible();
  await expect(alertsLink).toHaveAccessibleName("Alerts");
  await page.getByRole("button", { name: /Someone replied to your post/ }).click();
  await expect(page).toHaveURL(postUrl);
  await expect(page.getByText("Start with a short course")).toBeVisible();

  // Share copies the link.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("button", { name: /Link copied/ })).toBeVisible();

  // Edit, then delete.
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit your post" })).toBeVisible();
  await page.getByLabel("Your post").fill(`${text} (edited)`);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(`${text} (edited)`)).toBeVisible();
  await expect(page.getByText("· edited")).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await page.goto(postUrl))?.status()).toBe(404);
});

test("a like rolls back if saving fails", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page);
  await page.goto("/");
  const like = posts(page).first().getByRole("button", { name: /^Like\./ });
  const before = await like.getAttribute("aria-label");

  // Make the server action request fail.
  await page.route("**/*", (route) => (route.request().method() === "POST" && route.request().headers()["next-action"] ? route.abort() : route.continue()));
  await like.click();
  await expect(page.getByText("Couldn't save. Try again.")).toBeVisible();
  await expect(like).toHaveAttribute("aria-label", before!);
  await expect(like).toHaveAttribute("aria-pressed", "false");
});
