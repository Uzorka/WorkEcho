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

`SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. Use it only in
server-only files (`src/lib/supabase/admin.ts`). Never add a `NEXT_PUBLIC_` prefix to it.

Database changes go in `supabase/migrations/` as migration files. Dev-only
fictional seed data goes in `supabase/seed.sql`. Run `npm run db:reset` to apply both locally.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Production build |
| `npm run test:e2e` | End-to-end tests (Playwright); run `npm run build` first |
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
  middleware.ts     refreshes the Supabase session cookie
supabase/
  config.toml       Supabase CLI config
  migrations/       SQL migrations (with RLS)
  seed.sql          fictional dev data only
tests/unit/         Vitest
tests/e2e/          Playwright
```
