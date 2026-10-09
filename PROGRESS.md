# WorkEcho V1 — progress

- [x] **Slice 0 — Project setup**: Next.js, Tailwind, Supabase clients, env validation,
      app shell (bottom nav and sidebar), light and dark mode, placeholder pages, tests.
- [x] **Slice 1 — Accounts and anonymous identity**: Supabase Auth sign-up with email confirmation,
      login, logout, forgot/reset password, 3-step onboarding, server-generated pseudonyms, /me with
      change password and account deletion, route protection, `profiles` table + `public_profiles` view with RLS.
- [ ] Slice 2 — Companies and reviews
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
