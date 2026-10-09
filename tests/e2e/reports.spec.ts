import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./helpers";

// Uses the fictional seed data in supabase/seed.sql (run `npm run db:reset`).

test("company tabs: salaries, interviews and discussions", async ({ page }) => {
  await page.goto("/companies/demo-harbour-bank");
  const tabs = page.getByRole("navigation", { name: "Company sections" });
  await expect(tabs.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Pay ranges for 1 role")).toBeVisible();

  // Salaries: only the role + level with 3 reports is shown, never single salaries.
  await tabs.getByRole("link", { name: /Salaries/ }).click();
  await expect(tabs.getByRole("link", { name: /Salaries/ })).toHaveAttribute("aria-current", "page");
  const table = page.getByRole("table");
  await expect(table.getByRole("rowheader")).toHaveCount(1);
  await expect(table.getByRole("rowheader")).toContainText("Tech & IT");
  await expect(table.getByRole("rowheader")).toContainText("Mid level");
  await expect(table.getByRole("cell", { name: "₦520,000", exact: true })).toBeVisible();
  await expect(table.getByRole("cell", { name: "₦450,000 – ₦610,000" })).toBeVisible();
  await expect(page.getByText("Sales & Marketing")).toHaveCount(0);
  for (const single of ["₦180,000", "₦210,000", "180,000", "210,000"]) await expect(page.getByText(single)).toHaveCount(0);

  // Interviews: summary + list.
  await tabs.getByRole("link", { name: /Interviews/ }).click();
  await expect(page.getByRole("definition").filter({ hasText: "50%" })).toBeVisible();
  await expect(page.getByText("Got an offer").first()).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "25%" })).toBeVisible();
  await expect(page.getByText("5.3 weeks")).toBeVisible();
  await expect(page.getByText("3.0 / 5")).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(4);
  await expect(page.getByText("DemoReviewer", { exact: false })).toHaveCount(0);

  await tabs.getByRole("link", { name: "Discussions" }).click();
  await expect(page.getByText(/Discussions aren.t ready yet/)).toBeVisible();

  // A company without enough data shows friendly empty states.
  await page.goto("/companies/demo-kola-pay/salaries");
  await expect(page.getByText("Not enough salary data yet.")).toBeVisible();
  await page.goto("/companies/demo-kola-pay/interviews");
  await expect(page.getByText(/Not enough interview reports yet/)).toBeVisible();
  await expect(page.getByText("No interview reports yet.")).toBeVisible();

  // Forms need login.
  await page.goto("/companies/demo-kola-pay/salary");
  await expect(page).toHaveURL(/\/login\?next=%2Fcompanies%2Fdemo-kola-pay%2Fsalary/);
});

test("add a salary from the Create button, then edit it", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page);

  await page.goto("/create");
  await page.getByRole("link", { name: /Add a salary/ }).click();
  await page.getByLabel("Company name").fill("weaver");
  await page.getByRole("button", { name: "Find company" }).click();
  await page.getByRole("link", { name: /Demo Weaver Software/ }).click();
  await expect(page).toHaveURL(/\/companies\/demo-weaver-software\/salary$/);
  await expect(page.getByText(/exact salary is never shown/)).toBeVisible();

  // Empty submit: friendly errors.
  await page.getByRole("button", { name: "Add my salary" }).click();
  await expect(page.getByText("Choose the area you work in.")).toBeVisible();
  await expect(page.getByText("Enter your monthly gross pay in Naira, e.g. 250,000.")).toBeVisible();

  await page.getByLabel("Area you work in").selectOption("tech_it");
  await page.getByRole("group", { name: "Your level" }).getByText("Senior").click();
  await page.getByRole("group", { name: "Employment type" }).getByText("Full-time").click();
  await page.getByRole("group", { name: "Do you get a bonus?" }).getByText("Yes").click();
  await page.getByRole("group", { name: "Other benefits" }).getByText("HMO").click();
  await page.getByRole("group", { name: "Other benefits" }).getByText("13th month").click();

  // Too low: friendly message, and nothing else is lost.
  await page.getByLabel("Monthly gross pay (₦)").fill("25,000");
  await page.getByRole("button", { name: "Add my salary" }).click();
  await expect(page.getByText(/That looks too low for monthly pay/)).toBeVisible();
  await expect(page.getByLabel("Area you work in")).toHaveValue("tech_it");
  await expect(page.getByRole("radio", { name: "Senior" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "13th month" })).toBeChecked();

  // Too high (yearly by mistake).
  await page.getByLabel("Monthly gross pay (₦)").fill("60,000,000");
  await page.getByRole("button", { name: "Add my salary" }).click();
  await expect(page.getByText(/monthly \(not yearly\)/)).toBeVisible();

  await page.getByLabel("Monthly gross pay (₦)").fill("₦350,000");
  await page.getByRole("button", { name: "Add my salary" }).click();
  await expect(page).toHaveURL(/\/companies\/demo-weaver-software\/salaries\?notice=salary-submitted/);
  await expect(page.getByText(/Your salary will be counted within 72 hours/)).toBeVisible();
  // One report isn't enough to show anything.
  await expect(page.getByText("Not enough salary data yet.")).toBeVisible();
  await expect(page.getByText("350,000")).toHaveCount(0);

  // Edit: prefilled.
  await page.getByRole("link", { name: "Edit your salary" }).click();
  await expect(page.getByLabel("Monthly gross pay (₦)")).toHaveValue("350000");
  await expect(page.getByRole("radio", { name: "Senior" })).toBeChecked();
  await page.getByLabel("Monthly gross pay (₦)").fill("360000");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Your changes are saved.")).toBeVisible();
});

test("share an interview from the company page", async ({ page }) => {
  test.setTimeout(120_000);
  await signUpAndOnboard(page);

  await page.goto("/companies/demo-lily-hotels");
  await page.getByRole("link", { name: "Share an interview" }).click();
  await expect(page).toHaveURL(/\/companies\/demo-lily-hotels\/interview$/);
  await expect(page.getByText(/what you write can still reveal you/)).toBeVisible();

  await page.getByRole("button", { name: "Share my interview" }).click();
  await expect(page.getByText("How did it end?").last()).toBeVisible();
  await expect(page.getByText(/Tell us a bit more/)).toBeVisible();

  await page.getByLabel("Area of the role").selectOption("customer_service");
  await page.getByRole("group", { name: "How did it end?" }).getByText("Ghosted").click();
  await page.getByRole("group", { name: "How difficult was it?" }).getByText("2", { exact: true }).click();
  await page.getByLabel(/How many weeks/).fill("3");
  await page.getByRole("group", { name: "Which stages were there?" }).getByText("Aptitude test").click();
  await page.getByLabel("What did they ask?").fill("Why do you want to work in hospitality? A role play with a guest.");
  await page.getByRole("group", { name: "Overall experience" }).getByText("Neutral").click();
  await page.getByRole("button", { name: "Share my interview" }).click();

  await expect(page).toHaveURL(/\/companies\/demo-lily-hotels\/interviews\?notice=interview-submitted/);
  await expect(page.getByText(/will appear within 72 hours/)).toBeVisible();
  // Not visible yet (random delay).
  await expect(page.getByText("A role play with a guest", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Edit your interview" })).toBeVisible();
});
