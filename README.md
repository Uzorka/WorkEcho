# WorkEcho

Anonymous workplace reviews for Nigerian workers. Employees and former
employees review companies and report salaries and interview experiences.
Job seekers can read everything without signing up.

Project rules live in [CLAUDE.md](CLAUDE.md), and build progress is in [PROGRESS.md](PROGRESS.md).

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS, Supabase (Postgres, Auth, RLS),
Zod, Vitest, Playwright. Deployed on Vercel.

## Run locally

Requirements: Node 20.9+ (22 recommended). Docker is needed only if you run Supabase locally.

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000
```

To open it on your phone, connect it to the same Wi-Fi and run `npm run dev -- -H 0.0.0.0`.
Then visit `http://<your-laptop-ip>:3000`.

### Supabase

Use **either** of these:

- **Hosted project:** go to Supabase dashboard → Project Settings → API. Copy the Project URL and
  the `anon` public key into `.env.local`.
- **Local (needs Docker):** run `npm run db:start`, then copy the `API URL` and `anon key` it
  prints. Studio runs at http://127.0.0.1:54323. Stop it with `npm run db:stop`.

The app checks its environment variables at startup and refuses to start if
they are missing or malformed.

`SUPABASE_SERVICE_ROLE_KEY` is required. It bypasses Row Level Security, so use it only in
server-only files (`src/lib/supabase/admin.ts`). Never add a `NEXT_PUBLIC_` prefix to it.

### Auth emails

Locally, confirmation and password-reset emails are caught by Mailpit at http://127.0.0.1:54324.
Our templates live in `supabase/templates/` and link to `/auth/confirm?token_hash=…`, which works
even when the link is opened in a different browser or device.

For a **hosted** project, in the Supabase dashboard:

1. Authentication → Sign In / Providers → Email: turn on **Confirm email**; set minimum password length to 8.
2. Authentication → URL Configuration: set **Site URL** to your site (same as `NEXT_PUBLIC_SITE_URL`)
   and add `https://<your-site>/**` to the redirect URLs.
3. Authentication → Emails: paste `supabase/templates/confirmation.html` into "Confirm signup" and
   `supabase/templates/recovery.html` into "Reset password". (Without this, Supabase's default
   links still work, but only in the same browser the user signed up in.)
4. Set up custom SMTP before launch; Supabase's built-in email sender is heavily rate-limited.

Database changes go in `supabase/migrations/` as migration files. Dev-only
fictional seed data goes in `supabase/seed.sql` (20 "Demo …" companies and a few demo reviews).
Run `npm run db:reset` to apply both locally. The end-to-end tests expect the seed data.

### Verification emails (Slice 6)

Work-email codes are sent with [Resend](https://resend.com). Set `RESEND_API_KEY` and
`EMAIL_FROM_ADDRESS` (an address on a domain you've verified in Resend) in Vercel. Locally, add
`MAILPIT_URL=http://127.0.0.1:54324` to `.env.local` and codes land in Mailpit instead.

### Admins

Admin rights can only be granted in the database. In the Supabase SQL editor:

```sql
update public.profiles
set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

The account must have finished onboarding (so it has a profile). Admins then see "Open the admin area" on /me.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Production build |
| `npm run test:db` | Database permission tests (needs local Supabase running and `.env.local`) |
| `npm run test:e2e` | End-to-end tests (Playwright); run `npm run build` first. The account tests need local Supabase (they read emails from Mailpit) |
| `npm run check` | Lint + typecheck + unit tests + build |

For Playwright, run `npx playwright install chromium` once. If you already have a
Chromium binary, set `PLAYWRIGHT_CHROMIUM_PATH` to its path instead.

## Structure

```
src/
  app/              routes (App Router), plus 404, error and loading pages
  components/       app shell: sidebar, bottom nav, theme toggle
  lib/env*.ts       Zod-validated environment variables
  lib/supabase/     browser, server, middleware and server-only admin clients
  lib/pseudonym.ts  pseudonym generator
  lib/routes.ts     which pages need login / onboarding
  middleware.ts     refreshes the Supabase session cookie and protects routes
supabase/
  config.toml       Supabase CLI config
  migrations/       SQL migrations (with RLS)
  templates/        auth email templates
  seed.sql          fictional dev data only
tests/unit/         Vitest
tests/db/           Vitest permission tests against a real local Supabase
tests/e2e/          Playwright
```
