# WorkEcho launch checklist

Work through this top to bottom. Tick each box when it's done. Nothing here
needs code changes. Never paste keys or secrets into chat, issues or commits;
only put them in Vercel or Supabase.

## 1. Database (Supabase → SQL Editor)

- [ ] Run `workecho-slice6-database.sql` (verified checkmark), if not done yet.
- [ ] Run `workecho-slice7-database.sql` (daily clean-up).
- [ ] Supabase → **Advisors → Security Advisor**: run it and fix anything marked ERROR.
- [ ] Turn on backups. The free plan has none, so plan Pro before real users arrive.

## 2. Code

- [ ] Merge `claude/busy-gauss-lj3z95` into `main` on GitHub. Vercel then deploys it.

## 3. Vercel → Project → Settings → Environment Variables

Tick **Production and Preview** for each one, then redeploy.

| Name | Value |
| --- | --- |
| `CRON_SECRET` | A long random string, 32+ characters. A password manager's "generate" button works. |
| `RESEND_API_KEY` | From resend.com → API Keys |
| `EMAIL_FROM_ADDRESS` | e.g. `no-reply@yourdomain.ng`, on a domain verified in Resend |
| `NEXT_PUBLIC_SITE_URL` | Your final address, e.g. `https://workecho.ng`, once you have a domain |

- [ ] After redeploying, check that Vercel → Project → **Settings → Cron Jobs** lists
      `/api/cron/maintenance` (daily, 03:17 UTC). Its logs should show status 200.

## 4. Emails

- [ ] Supabase → **Authentication → Emails → SMTP Settings**: use Resend's SMTP so sign-up
      and password emails aren't limited to a few an hour.
- [ ] Create the real mailboxes `privacy@` and `takedown@` on your domain. If your domain
      isn't workecho.ng, change them in `src/lib/site.ts`.

## 5. Domain and search

- [ ] Vercel → Domains: add your domain.
- [ ] Supabase → Authentication → URL Configuration: set Site URL to the domain and add
      `https://yourdomain/**` to Redirect URLs.
- [ ] Google Search Console: add the domain and submit `https://yourdomain/sitemap.xml`.

## 6. Content and legal

- [ ] Check the 100 starter companies. Remove or fix any that are wrong (Admin → Companies).
- [ ] Add work-email domains for companies (Admin → Companies → Edit) so verification works.
- [ ] Have a Nigerian lawyer review /privacy, /terms and /guidelines (NDPA 2023).
- [ ] Make your own account admin, and a second trusted moderator too.

## 7. Final manual test on a real phone (360px wide)

- [ ] Logged out: browse companies, read reviews, salaries and interviews, open a post.
- [ ] Sign up (the email arrives), finish onboarding, write a post and a reply.
- [ ] Write a review: it says it publishes in 12–72 hours.
- [ ] Report something, and see it in Admin → Reports.
- [ ] Verify with a work email (the code arrives), and see the checkmark on your posts.
- [ ] Dark mode looks right; nothing scrolls sideways.
