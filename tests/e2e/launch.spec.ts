import { expect, test } from "@playwright/test";
import { localEnv } from "./helpers";

// Slice 7: launch checks across every public page — layout at 360px,
// basic accessibility, privacy of the HTML, headers, robots and sitemap.

const COMPANY = "demo-harbour-bank";
const POST = "10000000-0000-4000-8000-000000000001";

const PUBLIC_PAGES = [
  "/",
  "/companies",
  `/companies/${COMPANY}`,
  `/companies/${COMPANY}/reviews`,
  `/companies/${COMPANY}/salaries`,
  `/companies/${COMPANY}/interviews`,
  `/companies/${COMPANY}/discussions`,
  `/posts/${POST}`,
  "/create",
  "/guidelines",
  "/verification",
  "/privacy",
  "/terms",
  "/login",
  "/signup",
  "/forgot-password",
];

// Seeded demo accounts: 00000000-0000-4000-8000-00000000000N.
const DEMO_USER_ID = /00000000-0000-4000-8000-0000000000\d\d/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// Emails we deliberately publish (contact addresses, examples in help text).
const ALLOWED_EMAILS = /^(privacy|takedown)@workecho\.ng$|@(company|yourcompany|example)\.(com|ng)$/;

for (const path of PUBLIC_PAGES) {
  test(`launch check: ${path}`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);

    // Privacy: no account ids or personal emails in what we send to the browser.
    const html = await page.content();
    expect(html).not.toMatch(DEMO_USER_ID);
    const emails = [...new Set(html.match(EMAIL) ?? [])].filter((e) => !ALLOWED_EMAILS.test(e) && !/\.(png|svg|js|css)$/.test(e));
    expect(emails).toEqual([]);

    const report = await page.evaluate(() => {
      const visible = (el: Element) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      };
      const name = (el: Element) =>
        (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title") || el.textContent || "").trim();
      const fields = [...document.querySelectorAll("input, select, textarea")].filter(
        (el) => (el as HTMLInputElement).type !== "hidden" && visible(el),
      );
      const buttons = [...document.querySelectorAll("button, [role=button], input[type=submit]")].filter(visible);
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        lang: document.documentElement.lang,
        title: document.title,
        h1s: [...document.querySelectorAll("h1")].filter(visible).length,
        unlabelled: fields
          .filter((el) => !((el as HTMLInputElement).labels?.length || el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")))
          .map((el) => el.outerHTML.slice(0, 80)),
        unnamed: [...buttons, ...[...document.querySelectorAll("a[href]")].filter(visible)]
          .filter((el) => !name(el) && !el.querySelector("img[alt]:not([alt=''])"))
          .map((el) => el.outerHTML.slice(0, 80)),
        imagesWithoutAlt: [...document.querySelectorAll("img:not([alt])")].length,
        smallButtons: buttons
          .filter((el) => (el as HTMLElement).getBoundingClientRect().height < 44)
          .map((el) => `${name(el).slice(0, 30)} (${Math.round((el as HTMLElement).getBoundingClientRect().height)}px)`),
      };
    });

    expect(report.overflow, "page scrolls sideways").toBeLessThanOrEqual(0);
    expect(report.lang).toBe("en-NG");
    expect(report.title).toMatch(/WorkEcho/);
    expect(report.h1s, "exactly one visible h1").toBe(1);
    expect(report.unlabelled, "form fields without a label").toEqual([]);
    expect(report.unnamed, "buttons/links without a name").toEqual([]);
    expect(report.imagesWithoutAlt).toBe(0);
    expect(report.smallButtons, "buttons under 44px tall").toEqual([]);
  });
}

test("unknown pages show a friendly 404", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: /home|companies/i }).first()).toBeVisible();
});

test("security headers are sent", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["content-security-policy"]).toContain("connect-src 'self'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("same-origin");
  expect(h["permissions-policy"]).toContain("camera=()");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("robots.txt keeps private pages out of search and points to the sitemap", async ({ request }) => {
  const text = await (await request.get("/robots.txt")).text();
  for (const path of ["/admin", "/me", "/alerts", "/create"]) expect(text).toContain(`Disallow: ${path}`);
  expect(text).toMatch(/Sitemap: .*\/sitemap\.xml/);
});

test("the sitemap lists public pages and active companies only", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  expect(xml).toContain(`/companies/${COMPANY}</loc>`);
  expect(xml).toContain(`/companies/${COMPANY}/salaries</loc>`);
  expect(xml).toContain("/privacy</loc>");
  expect(xml).not.toMatch(/\/(admin|me|alerts)</);
  expect(xml).not.toMatch(DEMO_USER_ID);
});

test.describe("daily clean-up endpoint", () => {
  test("refuses requests without the secret", async ({ request }) => {
    expect((await request.get("/api/cron/maintenance")).status()).toBe(401);
    const wrong = await request.get("/api/cron/maintenance", { headers: { authorization: "Bearer wrong-secret-wrong-secret" } });
    expect(wrong.status()).toBe(401);
    expect(await wrong.text()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
  });

  test("runs with the secret and returns counts only", async ({ request }) => {
    const secret = (await localEnv()).CRON_SECRET;
    test.skip(!secret, "CRON_SECRET not set in .env.local");
    const res = await request.get("/api/cron/maintenance", { headers: { authorization: `Bearer ${secret}` } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.rate_limit_events_deleted).toBe("number");
    expect(JSON.stringify(body)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
  });
});
