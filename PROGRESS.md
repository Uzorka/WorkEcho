# WorkEcho V1 — progress

- [x] **Slice 0 — Project setup**: Next.js, Tailwind, Supabase clients, env validation,
      app shell (bottom nav and sidebar), light and dark mode, placeholder pages, tests.
- [x] **Slice 1 — Accounts and anonymous identity**: Supabase Auth sign-up with email confirmation,
      login, logout, forgot/reset password, 3-step onboarding, server-generated pseudonyms, /me with
      change password and account deletion, route protection, `profiles` table + `public_profiles` view with RLS.
- [x] **Slice 2 — Companies and reviews**: companies, company requests (with near-duplicate check),
      reviews with a random 12–72h publish delay, helpful votes, public views and stats with thresholds,
      /companies search + filters + sort + pagination, company pages, 4-step review form with draft.
- [ ] Slice 3 — Salary and interview reports
- [ ] Slice 4 — Social feed, posts and replies
- [ ] Slice 5 — Safety, moderation and admin
- [ ] Slice 6 — Verified checkmark
- [ ] Slice 7 — Polish, audit and launch

## Slice 0 notes

- /create, /alerts and /me are honest placeholders, so every nav item goes somewhere real.
  They get built in Slices 1–4.
- No database tables yet. The first migration arrives in Slice 1.
- Checks: lint, typecheck, unit tests (3), build, and Playwright (26 tests at
  360px mobile and desktop) all pass.

## Slice 1 notes

- **Database** (`supabase/migrations/20261009120000_profiles.sql`): `profiles` with RLS. Users can
  select only their own row and update only `user_type` and `state` (column grants). No insert/delete
  for users. `is_admin`, `is_banned`, `pseudonym`, `pseudonym_regenerations` and `onboarded_at` are
  writable only by server code (service role) or the `complete_onboarding()` function.
  `public_profiles` exposes `pseudonym` only. Pseudonyms are unique ignoring case.
- **Pseudonyms** are generated on the server (`src/lib/pseudonym.ts`, `src/lib/profile-service.ts`):
  Adjective + Animal/Nature word + 10–99, e.g. QuietFalcon82. 58 × 60 × 90 ≈ 313k combinations.
  Up to 3 regenerations, only before onboarding is finished.
- **Middleware** (`src/lib/routes.ts`): /onboarding, /me and /reset-password need login; signed-in
  users who haven't finished onboarding are sent to /onboarding (legal pages and /auth stay open).
  Every server action also checks the session itself.
- `SUPABASE_SERVICE_ROLE_KEY` is now required (pseudonym assignment, account deletion).
- **For Slices 2–4:** content tables must reference `profiles(id)` with `ON DELETE SET NULL`, and
  public views must show `coalesce(pseudonym, 'Deleted user')`. /me already tells users this.
- **Not done yet:** `is_banned` is stored but not enforced (Slice 5). /create is still a public
  placeholder; it will require login when it gets real forms. Hosted Supabase needs the dashboard
  steps in the README (confirm email, URLs, email templates, SMTP).
- Checks: lint, typecheck, build, unit tests (24), DB permission tests (21) and Playwright
  (34 tests at 360px mobile and desktop, including two full account flows) all pass.

## Slice 2 notes

- **Database** (`supabase/migrations/20261010120000_companies_reviews.sql`):
  - `companies`: anyone reads `active` rows; nobody but the service role writes.
  - `company_requests`: created only through `request_company()`, which rejects near-duplicates
    (`pg_trgm` similarity ≥ 0.5 on names with "Ltd", "Plc", "Nigeria"… stripped) of active companies
    and of pending requests, and caps each user at 5 pending requests. Users see their own requests,
    never the requester id. Approval is Slice 5.
  - `reviews`: one per user per company (unique constraint). Column grants: users can never read
    `author_id` or `publish_at`, and can never set `author_id`, `status` or `publish_at`.
    `publish_at` defaults to now + 12–72h. Authors can edit (unless removed) and delete their own.
    Writing needs a finished, non-banned profile and an active company. `author_id` is
    `ON DELETE SET NULL`, so reviews survive account deletion.
  - `review_helpful`: one vote per user per review (primary key); not on your own review, not on
    hidden/unpublished ones. Users can read only their own votes, without user ids.
  - Public reads: `public_reviews` (no author id, quarter only), `company_reviews()` (sorted pages;
    dates used for sorting never leave the DB), `company_stats` (ratings at ≥ 3 reviews, each
    Nigeria % at ≥ 3 answers), `company_department_stats` (only departments with ≥ 10 reviews).
- **Added beyond the brief:** an optional `state` on reviews (CLAUDE.md says reviews show status,
  state and quarter); "Not sure" as an answer to the Nigeria questions (stored as null, excluded
  from percentages).
- **Seed:** 20 companies named "Demo …", plus 5 login-less demo reviewers and 7 reviews
  (Demo Harbour Bank has enough for ratings; Demo Kola Pay has 2, so it shows "not enough").
- **Fixed from Slice 0:** removed the app-wide `src/app/loading.tsx`. With it, client-side
  navigation to dynamic pages (e.g. Clear filters, sort tabs) silently hung at random in Chromium;
  without it, 24/24 navigations worked. Pages render in tens of milliseconds, so it isn't missed.
  Company cards also don't prefetch (saves mobile data).
- **Not done yet:** pagination is only exercised manually (20 seeded companies = 1 page). No
  moderation/reporting of reviews yet (Slice 5). /create still links to Companies for reviews.
- Checks: lint, typecheck, build, unit tests (33), DB permission tests (47) and Playwright
  (40 tests at 360px mobile and desktop) all pass.
