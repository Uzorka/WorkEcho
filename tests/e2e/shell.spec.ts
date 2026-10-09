import { expect, test } from "@playwright/test";

const pages = [
  { path: "/", heading: /know the company/i },
  { path: "/companies", heading: "Companies" },
  { path: "/create", heading: "Create" },
  { path: "/login", heading: "Log in" },
  { path: "/forgot-password", heading: /forgot your password/i },
  { path: "/check-email", heading: /check your email/i },
  { path: "/signup", heading: /create an account/i },
  { path: "/privacy", heading: "Privacy" },
  { path: "/terms", heading: "Terms" },
  { path: "/guidelines", heading: /community guidelines/i },
];

for (const p of pages) {
  test(`renders ${p.path}`, async ({ page }) => {
    const res = await page.goto(p.path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: p.heading })).toBeVisible();
  });
}

for (const path of ["/me", "/alerts"]) {
  test(`${path} asks logged-out visitors to log in`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible();
  });
}

test("nav links work", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
  for (const label of ["Companies", "Create", "Home"]) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
  }
});

test("unknown page shows 404", async ({ page }) => {
  const res = await page.goto("/does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /couldn.t find that page/i })).toBeVisible();
});

test("theme toggle switches and persists", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");
  const toggle = page.getByRole("button", { name: /^Theme:/ }).filter({ visible: true }).first();
  await toggle.click(); // system -> light
  await toggle.click(); // light -> dark
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
});
