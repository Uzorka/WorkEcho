# WorkEcho — project rules

## What this is
WorkEcho is an anonymous workplace review platform for Nigerian workers.
Employees and former employees review companies, report salaries and
interview experiences, and discuss work in a simple social feed.
Job seekers read all of it, without signing up, before accepting offers.

## Repository
- All work happens in https://github.com/Uzorka/WorkEcho (branch: main).
- Work in the cloned repo folder only. Never create a new project or a
  nested project folder; the repo root IS the app root.
- Commit after each completed slice with a clear message
  (e.g. "Slice 2: companies and reviews"). Never commit .env files or keys.

## Stack (do not change without asking)
- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase: Postgres, Auth (email + password), Row Level Security
- Zod for validation; server actions for all writes
- Vitest for unit tests, Playwright for a few end-to-end tests
- Deployed on Vercel
- Keep dependencies few. No UI kits unless asked. No animation library in V1.

## Privacy rules (most important — never break these)
1. Public pages and public queries NEVER return user IDs, emails, or anything
   that links content to an account. Use database views or server code that
   select only safe columns.
2. The browser never reads base tables that contain author IDs. Anonymous
   and logged-in users read through safe views only. RLS is on for every table.
3. Never use the Supabase service-role key in client code or in any file
   that can be bundled to the browser.
4. Social posts and replies show the author's pseudonym. Reviews, salary
   reports and interview reports show NO pseudonym — only employment status
   (current/former), state, and quarter (e.g. "Q3 2026").
5. Never collect phone numbers, real names, photos, exact job titles or exact
   dates of employment.
6. Thresholds: overall company rating shows at >= 3 published reviews;
   department breakdowns at >= 10; salary ranges at >= 3 reports per
   role group + level. Below that, show a friendly "not enough data yet" state.
7. Reviews, salary and interview reports publish after a random delay of
   12-72 hours (store `publish_at`; public views filter `publish_at <= now()`).
8. Do not log request bodies, emails or user IDs alongside content IDs.
   Error messages shown to users must never contain internal IDs.
9. Never promise "100% anonymous". Say "we protect your identity, but what
   you write can still reveal you".
10. The verified checkmark is earned ONLY by passing verification. There is
   no code path, admin button or payment that grants it. Admins may only
   revoke it. It must never be connected to any payment or subscription.

## Content rules (enforced in UI copy and moderation)
- Review the company, not named individuals.
- No unproven crime accusations, confidential documents, threats or contact details.
- Positive, mixed and negative experiences are all welcome.
- Employers can never pay to hide reviews or change ratings.

## Product language
- Nigerian English, plain and friendly. Currency is Naira (₦), monthly gross pay.
- Locations use the 36 states + FCT.

## Design
- Mobile-first. Must look right at 360px wide on a mid-range Android phone.
- Calm, trustworthy look. Primary colour #465D93 (indigo), light surface
  #F8F9FF, text #171B26. Rounded cards, generous spacing. Light + dark mode.
- Bottom navigation on mobile, left sidebar on desktop.
- Fast and light: avoid heavy client JavaScript, big images and fancy animation.
  Small CSS transitions only, and respect prefers-reduced-motion.
- Accessible: real buttons and labels, visible focus, good contrast, 44px touch targets.

## How to work
- Read existing code before changing it. Keep what works.
- Write a migration in `supabase/migrations` for every schema change, with RLS policies.
- Add tests for every permission rule (anonymous visitor, user A, user B, admin).
- No fake buttons, fake data on real pages, or fake success messages.
  Dev seed data must be clearly fictional and live in `supabase/seed.sql` only.
- Run lint, type check, tests and `next build` before saying a slice is done.
- Never claim something works or tests pass unless you ran it.
- Finish each slice by updating PROGRESS.md and reporting: what was built,
  how to test it manually, test results, and anything unfinished.
- Do not start the next slice until asked.
