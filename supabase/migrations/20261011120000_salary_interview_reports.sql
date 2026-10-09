-- Slice 3: salary and interview reports.
--
-- Same privacy model as reviews (see 20261010120000_companies_reviews.sql):
-- users never read author_id or publish_at, never set author_id, status or
-- publish_at, and the public reads through safe views/functions only.
-- Salaries are NEVER exposed per report: the only public salary data is the
-- aggregate view company_salary_stats (groups with >= 3 reports, rounded to
-- the nearest ₦10,000).

create type public.salary_level as enum ('entry', 'mid', 'senior', 'manager', 'executive');
create type public.interview_outcome as enum ('offer', 'no_offer', 'ghosted', 'withdrew');
create type public.interview_experience as enum ('positive', 'neutral', 'negative');

-- ---------------------------------------------------------------- salary reports

create table public.salary_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  -- Same broad list as review departments.
  role_group public.department not null,
  level public.salary_level not null,
  employment_type public.employment_type not null,
  state text check (public.is_nigerian_state(state)),
  -- Monthly gross pay in Naira. Anything outside this range is almost certainly a typo.
  monthly_gross_naira integer not null check (monthly_gross_naira between 30000 and 50000000),
  has_bonus boolean not null,
  -- Empty array = none of these.
  other_benefits text[] not null default '{}'
    check (other_benefits <@ array['hmo', 'transport', 'housing', 'thirteenth_month', 'feeding']::text[]),
  status public.review_status not null default 'published',
  publish_at timestamptz not null default (now() + interval '12 hours' + random() * interval '60 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint one_salary_report_per_company unique (company_id, author_id)
);

create index salary_reports_company_visible_idx on public.salary_reports (company_id, status, publish_at);
create index salary_reports_author_idx on public.salary_reports (author_id);

create trigger salary_reports_touch_updated_at
  before update on public.salary_reports
  for each row execute function public.touch_updated_at();

alter table public.salary_reports enable row level security;
revoke all on table public.salary_reports from anon, authenticated;

grant select (
  id, company_id, role_group, level, employment_type, state, monthly_gross_naira, has_bonus,
  other_benefits, status, created_at, updated_at
) on table public.salary_reports to authenticated;
grant insert (
  company_id, role_group, level, employment_type, state, monthly_gross_naira, has_bonus, other_benefits
) on table public.salary_reports to authenticated;
grant update (
  role_group, level, employment_type, state, monthly_gross_naira, has_bonus, other_benefits
) on table public.salary_reports to authenticated;
grant delete on table public.salary_reports to authenticated;

create policy "Authors read their own salary reports"
  on public.salary_reports for select to authenticated
  using (author_id = (select auth.uid()));

create policy "Signed-in users report salaries for active companies"
  on public.salary_reports for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select public.can_contribute())
    and exists (select 1 from public.companies c where c.id = company_id and c.status = 'active')
  );

create policy "Authors edit their own salary reports unless removed"
  on public.salary_reports for update to authenticated
  using (author_id = (select auth.uid()) and status <> 'removed')
  with check (author_id = (select auth.uid()));

create policy "Authors delete their own salary reports"
  on public.salary_reports for delete to authenticated
  using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------- interview reports

create table public.interview_reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  role_group public.department not null,
  outcome public.interview_outcome not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  -- Null = not sure.
  process_weeks smallint check (process_weeks between 0 and 52),
  stages text[] not null default '{}'
    check (stages <@ array['aptitude_test', 'phone_call', 'panel', 'assessment', 'final_interview']::text[]),
  questions_asked text not null check (char_length(btrim(questions_asked)) between 10 and 3000),
  tips text check (char_length(tips) <= 2000),
  experience public.interview_experience not null,
  status public.review_status not null default 'published',
  publish_at timestamptz not null default (now() + interval '12 hours' + random() * interval '60 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint one_interview_report_per_company unique (company_id, author_id)
);

create index interview_reports_company_visible_idx on public.interview_reports (company_id, status, publish_at);
create index interview_reports_author_idx on public.interview_reports (author_id);

create trigger interview_reports_touch_updated_at
  before update on public.interview_reports
  for each row execute function public.touch_updated_at();

alter table public.interview_reports enable row level security;
revoke all on table public.interview_reports from anon, authenticated;

grant select (
  id, company_id, role_group, outcome, difficulty, process_weeks, stages, questions_asked, tips,
  experience, status, created_at, updated_at
) on table public.interview_reports to authenticated;
grant insert (
  company_id, role_group, outcome, difficulty, process_weeks, stages, questions_asked, tips, experience
) on table public.interview_reports to authenticated;
grant update (
  role_group, outcome, difficulty, process_weeks, stages, questions_asked, tips, experience
) on table public.interview_reports to authenticated;
grant delete on table public.interview_reports to authenticated;

create policy "Authors read their own interview reports"
  on public.interview_reports for select to authenticated
  using (author_id = (select auth.uid()));

-- Anyone signed in and onboarded can submit, job seekers included.
create policy "Signed-in users report interviews at active companies"
  on public.interview_reports for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select public.can_contribute())
    and exists (select 1 from public.companies c where c.id = company_id and c.status = 'active')
  );

create policy "Authors edit their own interview reports unless removed"
  on public.interview_reports for update to authenticated
  using (author_id = (select auth.uid()) and status <> 'removed')
  with check (author_id = (select auth.uid()));

create policy "Authors delete their own interview reports"
  on public.interview_reports for delete to authenticated
  using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------- public reads

-- Salary ranges per role group + level, only where >= 3 visible reports.
-- Median, lowest and highest are rounded to the nearest ₦10,000.
create view public.company_salary_stats
  with (security_barrier = true)
as
select
  s.company_id,
  s.role_group,
  s.level,
  count(*)::int as report_count,
  (round((percentile_cont(0.5) within group (order by s.monthly_gross_naira))::numeric / 10000) * 10000)::int as median_naira,
  (round(min(s.monthly_gross_naira)::numeric / 10000) * 10000)::int as lowest_naira,
  (round(max(s.monthly_gross_naira)::numeric / 10000) * 10000)::int as highest_naira
from public.salary_reports s
join public.companies c on c.id = s.company_id and c.status = 'active'
where s.status = 'published' and s.publish_at <= now()
group by s.company_id, s.role_group, s.level
having count(*) >= 3;

revoke all on table public.company_salary_stats from anon, authenticated;
grant select on table public.company_salary_stats to anon, authenticated;

-- Visible interview reports: no author_id, quarter only.
create view public.public_interview_reports
  with (security_barrier = true)
as
select
  i.id,
  i.company_id,
  i.role_group,
  i.outcome,
  i.difficulty,
  i.process_weeks,
  i.stages,
  i.questions_asked,
  i.tips,
  i.experience,
  'Q' || extract(quarter from i.publish_at at time zone 'Africa/Lagos')::int
    || ' ' || extract(year from i.publish_at at time zone 'Africa/Lagos')::int as published_quarter
from public.interview_reports i
join public.companies c on c.id = i.company_id and c.status = 'active'
where i.status = 'published' and i.publish_at <= now();

revoke all on table public.public_interview_reports from anon, authenticated;
grant select on table public.public_interview_reports to anon, authenticated;

-- Newest first; dates used for sorting never leave the database.
create function public.company_interviews(p_company_id uuid, p_limit int default 10, p_offset int default 0)
  returns setof public.public_interview_reports
  language sql stable security definer set search_path = ''
as $$
  select pi.*
    from public.public_interview_reports pi
    join public.interview_reports i on i.id = pi.id
   where pi.company_id = p_company_id
   order by i.publish_at desc, pi.id
   limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke all on function public.company_interviews(uuid, int, int) from public;
grant execute on function public.company_interviews(uuid, int, int) to anon, authenticated;

-- Interview summary per company. Percentages and averages show at >= 3 reports.
create view public.company_interview_stats
  with (security_barrier = true)
as
with v as (
  select i.* from public.interview_reports i
   where i.status = 'published' and i.publish_at <= now()
)
select
  c.id as company_id,
  count(v.id)::int as report_count,
  case when count(v.id) >= 3 then round(100.0 * count(*) filter (where v.outcome = 'offer') / count(v.id))::int end as offer_pct,
  case when count(v.id) >= 3 then round(100.0 * count(*) filter (where v.outcome = 'ghosted') / count(v.id))::int end as ghosted_pct,
  case when count(v.process_weeks) >= 3 then round(avg(v.process_weeks), 1) end as avg_weeks,
  case when count(v.id) >= 3 then round(avg(v.difficulty), 1) end as avg_difficulty,
  case when count(v.id) >= 3 then round(100.0 * count(*) filter (where v.experience = 'positive') / count(v.id))::int end as positive_pct
from public.companies c
left join v on v.company_id = c.id
where c.status = 'active'
group by c.id;

revoke all on table public.company_interview_stats from anon, authenticated;
grant select on table public.company_interview_stats to anon, authenticated;

-- Visible salary report count per company (for tab labels). Counts only, no amounts.
create view public.company_salary_counts
  with (security_barrier = true)
as
select c.id as company_id, count(s.id)::int as report_count
from public.companies c
left join public.salary_reports s
  on s.company_id = c.id and s.status = 'published' and s.publish_at <= now()
where c.status = 'active'
group by c.id;

revoke all on table public.company_salary_counts from anon, authenticated;
grant select on table public.company_salary_counts to anon, authenticated;
