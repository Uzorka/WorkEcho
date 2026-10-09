import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

// Uses the fictional seed data in supabase/seed.sql (run `npm run db:reset`).

test("browse, search, filter and read a company", async ({ page }) => {
  await page.goto("/companies");
  await expect(page.getByText("20 companies")).toBeVisible();

  await page.getByLabel("Search by name").fill("harbour");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("1 company found")).toBeVisible();

  await page.getByRole("link", { name: "Clear" }).click();
  await expect(page.getByLabel("Search by name")).toHaveValue("");
  await page.getByLabel("Industry").selectOption("Fintech");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByRole("link", { name: /Demo Kola Pay/ })).toBeVisible();
  await expect(page.getByText(/Not enough reviews yet/)).toBeVisible();

  // Highest rated first: Harbour Bank is the only one with a rating.
  await page.goto("/companies?sort=rating");
  await expect(page.getByRole("list").first().getByRole("link").first()).toContainText("Demo Harbour Bank");

  await page.goto("/companies/demo-harbour-bank");
  await expect(page.getByRole("heading", { level: 1, name: "Demo Harbour Bank" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Rated 3.8 out of 5" })).toBeVisible();
  await expect(page.getByText("Salary on time: 80% yes")).toBeVisible();
  await expect(page.getByText("Department ratings appear once a department has 10 reviews.")).toBeVisible();
  // Reviews show no pseudonym, only status/department/type/state/quarter.
  await expect(page.getByText("DemoReviewer", { exact: false })).toHaveCount(0);
  await expect(page.getByText(/Q[1-4] \d{4}/).first()).toBeVisible();

  await page.getByRole("link", { name: "Lowest rated" }).click();
  await expect(page).toHaveURL(/sort=lowest/);
  await expect(page.getByRole("article").first().getByRole("img")).toHaveAccessibleName(/Rated 3 out of 5/);

  await page.goto("/companies/demo-kola-pay");
  await expect(page.getByText(/Not enough reviews yet\. We show ratings once 3 people/)).toBeVisible();
  await expect(page.getByText(/\(2 so far\)/)).toBeVisible();

  // Unknown company -> 404; writing a review needs login.
  expect((await page.goto("/companies/no-such-company"))?.status()).toBe(404);
  await page.goto("/companies/demo-kola-pay/review");
  await expect(page).toHaveURL(/\/login\?next=%2Fcompanies%2Fdemo-kola-pay%2Freview/);
});

test("write a review in 4 steps, with a saved draft, then edit it", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page);
  await page.goto("/companies/demo-weaver-software");
  await page.getByRole("link", { name: "Write a review" }).click();

  // Step 1
  await expect(page.getByText("Step 1 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Are you a current or former employee?")).toBeVisible();
  await page.getByText("Former employee", { exact: true }).click();
  await page.getByText("NYSC", { exact: true }).click();
  await page.getByLabel("Department").selectOption("tech_it");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  for (const label of ["Overall", "Pay & benefits", "Work-life balance", "Management", "Culture", "Career growth"])
    await page.getByRole("group", { name: label, exact: true }).getByText("4", { exact: true }).click();

  // Draft survives a reload.
  await page.reload();
  await expect(page.getByText("We restored the draft saved on this device.")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3
  await expect(page.getByText("Step 3 of 4")).toBeVisible();
  await page.getByRole("group", { name: "Was salary paid on time?" }).getByText("Sometimes").click();
  await page.getByLabel("How long was probation?").selectOption("6");
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4 with preview
  await expect(page.getByText("Step 4 of 4")).toBeVisible();
  await expect(page.getByText(/what you write can still reveal you/i)).toBeVisible();
  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByText(/headline needs at least/i)).toBeVisible();
  await page.getByLabel("Headline").fill("Good place for corpers");
  await page.getByLabel("Pros").fill("You get real work and patient mentors who explain things.");
  await page.getByLabel("Cons").fill("The allowance is small and sometimes arrives late.");
  const preview = page.getByRole("region", { name: "Preview" });
  await expect(preview.getByText("Good place for corpers")).toBeVisible();
  await expect(preview.getByText(/Former employee · Tech & IT · NYSC/)).toBeVisible();
  await expect(preview.getByText("Salary on time: Sometimes")).toBeVisible();
  await page.getByRole("button", { name: "Submit review" }).click();

  await expect(page).toHaveURL(/\/companies\/demo-weaver-software\?notice=review-submitted/);
  await expect(page.getByText(/Your review will appear within 72 hours/)).toBeVisible();
  // Not visible to readers yet.
  await expect(page.getByText("Good place for corpers")).toHaveCount(0);
  const draft = await page.evaluate(() => localStorage.getItem("workecho:review-draft:demo-weaver-software"));
  expect(draft).toBeNull();

  // Edit: the form is prefilled.
  await page.getByRole("link", { name: "Edit your review" }).click();
  await expect(page.getByRole("heading", { name: /Edit your review of Demo Weaver Software/ })).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Headline")).toHaveValue("Good place for corpers");
  await page.getByLabel("Headline").fill("Good place for NYSC members");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Your changes are saved.")).toBeVisible();

  // Helpful votes on someone else's review: toggles on and off, counted once.
  await page.goto("/companies/demo-harbour-bank");
  const first = page.getByRole("article").first();
  const button = first.getByRole("button", { name: /Helpful/ });
  const before = Number((await button.textContent())!.match(/\d+/)![0]);
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(button).toHaveText(`Helpful (${before + 1})`);
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(button).toHaveText(`Helpful (${before})`);
});

test("request a missing company", async ({ page }) => {
  test.setTimeout(90_000);
  // Mostly random, so it isn't a near-duplicate of names from earlier runs.
  const name = `Fictional ${randomUUID().replaceAll("-", "").slice(0, 20)}`;

  // Logged out: asked to log in.
  await page.goto(`/companies?q=${encodeURIComponent(name)}`);
  await expect(page.getByRole("heading", { name: `Can't find “${name}”?` })).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in to request a company" })).toBeVisible();

  await signUpAndOnboard(page);

  // Near-duplicate of an existing company is caught.
  await page.goto(`/companies?q=${encodeURIComponent("Harbour Bank Plc")}`);
  await page.getByLabel("Industry").last().selectOption("Banking & Finance");
  await page.getByRole("button", { name: "Request this company" }).click();
  await expect(page.getByText(/already have a company with a very similar name/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Demo Harbour Bank" })).toBeVisible();

  // A genuinely new company is accepted.
  await page.goto(`/companies?q=${encodeURIComponent(name)}`);
  await expect(page.getByLabel("Company name")).toHaveValue(name);
  await page.getByLabel("Industry").last().selectOption("Other");
  await page.getByLabel("Website (optional)").fill("example.com");
  await page.getByRole("button", { name: "Request this company" }).click();
  await expect(page.getByText(/Thanks! We'll check the details/)).toBeVisible();
});
