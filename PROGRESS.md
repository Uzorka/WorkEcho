# WorkEcho V1 — progress

- [x] **Slice 0 — Project setup**: Next.js, Tailwind, Supabase clients, env validation,
      app shell (bottom nav and sidebar), light and dark mode, placeholder pages, tests.
- [ ] Slice 1 — Accounts and anonymous identity
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
