-- Slice 2: companies and reviews.
--
-- Privacy model:
-- * companies has no author data, so active companies are readable directly.
-- * reviews and review_helpful contain user ids. Nobody (anon or signed in)
--   can select those id columns. Signed-in users can see a few columns of
--   their OWN rows (to edit or un-vote); everyone else reads public_reviews,
--   company_reviews() and company_stats, which never expose author ids or
--   exact dates.
-- * Reviews publish after a random 12–72 hour delay (publish_at default).
--   Users can't set publish_at or status.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------- types

create type public.company_status as enum ('active', 'pending');
create type public.employment_status as enum ('current', 'former');
create type public.department as enum (
  'sales_marketing', 'operations_logistics', 'finance_accounts', 'hr_admin', 'tech_it',
  'customer_service', 'production', 'management', 'other'
);
create type public.employment_type as enum ('full_time', 'contract', 'intern', 'nysc');
create type public.yes_no_sometimes as enum ('yes', 'no', 'sometimes');
create type public.probation_outcome as enum ('yes', 'no', 'not_yet');
create type public.review_status as enum ('published', 'hidden', 'removed');
create type public.request_status as enum ('pending', 'approved', 'rejected');

-- Shared lists (must match src/lib/companies.ts; a unit test checks this).
create function public.is_nigerian_state(s text) returns boolean
  language sql immutable set search_path = ''
as $$
  select s in (
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
    'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
    'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
    'Yobe', 'Zamfara'
  );
$$;

create function public.is_industry(s text) returns boolean
  language sql immutable set search_path = ''
as $$
  select s in (
    'Agriculture', 'Banking & Finance', 'Consulting & Professional Services', 'Education',
    'Energy & Power', 'FMCG & Manufacturing', 'Fintech', 'Government & Public Sector',
    'Healthcare & Pharma', 'Hospitality & Food', 'Insurance', 'Logistics & Transport',
    'Media & Entertainment', 'NGO & Non-profit', 'Oil & Gas', 'Real Estate & Construction',
    'Retail & E-commerce', 'Technology & Software', 'Telecoms', 'Other'
  );
$$;

-- ---------------------------------------------------------------- companies

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  industry text not null check (public.is_industry(industry)),
  state text check (public.is_nigerian_state(state)),
  city text check (char_length(city) <= 80),
  website text check (website ~ '^https?://' and char_length(website) <= 200),
  size_range text check (size_range in ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),
  description text check (char_length(description) <= 2000),
  status public.company_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index companies_name_trgm on public.companies using gin (name extensions.gin_trgm_ops);
create index companies_active_idx on public.companies (status, industry, state);

alter table public.companies enable row level security;
revoke all on table public.companies from anon, authenticated;
grant select on table public.companies to anon, authenticated;

create policy "Anyone can read active companies"
  on public.companies for select
  to anon, authenticated
  using (status = 'active');

-- Lowercase, drop punctuation and filler words ("Ltd", "Plc", "Nigeria"...),
-- so "Zenith Bank Plc" and "zenith bank nigeria ltd." compare equal.
create function public.normalize_company_name(n text) returns text
  language sql immutable set search_path = ''
as $$
  select coalesce(
    nullif(btrim(regexp_replace(
      regexp_replace(
        regexp_replace(lower(n), '[^a-z0-9 ]+', ' ', 'g'),
        '\m(limited|ltd|plc|nigeria|nig|ng|group|company|co|inc|the|and|of)\M', ' ', 'g'),
      '\s+', ' ', 'g')), ''),
    btrim(lower(n))
  );
$$;

-- ---------------------------------------------------------------- company requests

create table public.company_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  industry text not null check (public.is_industry(industry)),
  state text check (public.is_nigerian_state(state)),
  website text check (website ~ '^https?://' and char_length(website) <= 200),
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index company_requests_requester_idx on public.company_requests (requester_id);

alter table public.company_requests enable row level security;
revoke all on table public.company_requests from anon, authenticated;
-- Users see their own requests (without the requester id). Inserts go through request_company().
grant select (id, name, industry, state, website, status, created_at) on table public.company_requests to authenticated;

create policy "Users read their own company requests"
  on public.company_requests for select
  to authenticated
  using (requester_id = (select auth.uid()));

-- Request a missing company. Rejects near-duplicates of existing companies
-- and of requests already waiting for review.
-- Returns {"status": "created" | "duplicate" | "already_requested" | "too_many" | "invalid", "matches": [...]}.
create function public.request_company(p_name text, p_industry text, p_state text default null, p_website text default null)
  returns jsonb
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  norm text;
  matches jsonb;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = uid and not is_banned and onboarded_at is not null) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  p_name := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  p_state := nullif(btrim(coalesce(p_state, '')), '');
  p_website := nullif(btrim(coalesce(p_website, '')), '');
  if char_length(p_name) not between 2 and 120
     or not public.is_industry(p_industry)
     or (p_state is not null and not public.is_nigerian_state(p_state))
     or (p_website is not null and (p_website !~ '^https?://' or char_length(p_website) > 200)) then
    return jsonb_build_object('status', 'invalid');
  end if;

  norm := public.normalize_company_name(p_name);

  select coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'slug', m.slug)), '[]'::jsonb)
    into matches
    from (
      select c.name, c.slug
        from public.companies c
       where c.status = 'active'
         and (public.normalize_company_name(c.name) = norm
              or extensions.similarity(public.normalize_company_name(c.name), norm) >= 0.5)
       order by extensions.similarity(public.normalize_company_name(c.name), norm) desc
       limit 3
    ) m;
  if jsonb_array_length(matches) > 0 then
    return jsonb_build_object('status', 'duplicate', 'matches', matches);
  end if;

  if exists (
    select 1 from public.company_requests r
     where r.status = 'pending'
       and (public.normalize_company_name(r.name) = norm
            or extensions.similarity(public.normalize_company_name(r.name), norm) >= 0.5)
  ) then
    return jsonb_build_object('status', 'already_requested');
  end if;

  if (select count(*) from public.company_requests where requester_id = uid and status = 'pending') >= 5 then
    return jsonb_build_object('status', 'too_many');
  end if;

  insert into public.company_requests (requester_id, name, industry, state, website)
  values (uid, p_name, p_industry, p_state, p_website);
  return jsonb_build_object('status', 'created');
end;
$$;

revoke all on function public.request_company(text, text, text, text) from public, anon;
grant execute on function public.request_company(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------- reviews

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  -- Defaults to the caller; users can't set it. Kept (as null) when the
  -- author deletes their account, so the review stays up.
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  employment_status public.employment_status not null,
  department public.department,
  employment_type public.employment_type not null,
  -- State where they worked (optional). Shown on the review instead of any name.
  state text check (public.is_nigerian_state(state)),
  rating_overall smallint not null check (rating_overall between 1 and 5),
  rating_pay smallint not null check (rating_pay between 1 and 5),
  rating_work_life smallint not null check (rating_work_life between 1 and 5),
  rating_management smallint not null check (rating_management between 1 and 5),
  rating_culture smallint not null check (rating_culture between 1 and 5),
  rating_growth smallint not null check (rating_growth between 1 and 5),
  -- Nigeria questions. Null = "not sure".
  salary_on_time public.yes_no_sometimes,
  overtime_paid public.yes_no_sometimes,
  has_hmo public.yes_no_sometimes,
  pension_remitted public.yes_no_sometimes,
  got_contract public.yes_no_sometimes,
  probation_months smallint check (probation_months between 0 and 12),
  confirmed_after_probation public.probation_outcome,
  headline text not null check (char_length(btrim(headline)) between 5 and 120),
  pros text not null check (char_length(btrim(pros)) between 20 and 3000),
  cons text not null check (char_length(btrim(cons)) between 20 and 3000),
  advice_to_management text check (char_length(advice_to_management) <= 2000),
  status public.review_status not null default 'published',
  -- Random 12–72 hour delay so publication time can't point to the author.
  publish_at timestamptz not null default (now() + interval '12 hours' + random() * interval '60 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint one_review_per_company unique (company_id, author_id)
);

create index reviews_company_visible_idx on public.reviews (company_id, status, publish_at);
create index reviews_author_idx on public.reviews (author_id);

create function public.touch_updated_at() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function public.touch_updated_at();

alter table public.reviews enable row level security;
revoke all on table public.reviews from anon, authenticated;

-- Own rows only (policy below), and never author_id or publish_at.
grant select (
  id, company_id, employment_status, department, employment_type, state,
  rating_overall, rating_pay, rating_work_life, rating_management, rating_culture, rating_growth,
  salary_on_time, overtime_paid, has_hmo, pension_remitted, got_contract,
  probation_months, confirmed_after_probation, headline, pros, cons, advice_to_management,
  status, created_at, updated_at
) on table public.reviews to authenticated;

grant insert (
  company_id, employment_status, department, employment_type, state,
  rating_overall, rating_pay, rating_work_life, rating_management, rating_culture, rating_growth,
  salary_on_time, overtime_paid, has_hmo, pension_remitted, got_contract,
  probation_months, confirmed_after_probation, headline, pros, cons, advice_to_management
) on table public.reviews to authenticated;

grant update (
  employment_status, department, employment_type, state,
  rating_overall, rating_pay, rating_work_life, rating_management, rating_culture, rating_growth,
  salary_on_time, overtime_paid, has_hmo, pension_remitted, got_contract,
  probation_months, confirmed_after_probation, headline, pros, cons, advice_to_management
) on table public.reviews to authenticated;

grant delete on table public.reviews to authenticated;

-- True when the caller has a finished, non-banned profile.
create function public.can_contribute() returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and not is_banned and onboarded_at is not null
  );
$$;
revoke all on function public.can_contribute() from public, anon;
grant execute on function public.can_contribute() to authenticated;

create policy "Authors read their own reviews"
  on public.reviews for select
  to authenticated
  using (author_id = (select auth.uid()));

create policy "Signed-in users review active companies"
  on public.reviews for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (select public.can_contribute())
    and exists (select 1 from public.companies c where c.id = company_id and c.status = 'active')
  );

create policy "Authors edit their own reviews unless removed"
  on public.reviews for update
  to authenticated
  using (author_id = (select auth.uid()) and status <> 'removed')
  with check (author_id = (select auth.uid()));

create policy "Authors delete their own reviews"
  on public.reviews for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------- helpful votes

create table public.review_helpful (
  review_id uuid not null references public.reviews (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

create index review_helpful_user_idx on public.review_helpful (user_id);

alter table public.review_helpful enable row level security;
revoke all on table public.review_helpful from anon, authenticated;
grant select (review_id) on table public.review_helpful to authenticated;
grant insert (review_id) on table public.review_helpful to authenticated;
grant delete on table public.review_helpful to authenticated;

-- A review can be voted on if it's publicly visible and not the caller's own.
create function public.review_is_votable(p_review_id uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.reviews r
     where r.id = p_review_id
       and r.status = 'published'
       and r.publish_at <= now()
       and r.author_id is distinct from auth.uid()
  );
$$;
revoke all on function public.review_is_votable(uuid) from public, anon;
grant execute on function public.review_is_votable(uuid) to authenticated;

create policy "Users read their own votes"
  on public.review_helpful for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users vote on visible reviews"
  on public.review_helpful for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.can_contribute())
    and public.review_is_votable(review_id)
  );

create policy "Users remove their own votes"
  on public.review_helpful for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- public views

-- Published, visible reviews. No author_id, no exact dates: quarter only.
create view public.public_reviews
  with (security_barrier = true)
as
select
  r.id,
  r.company_id,
  r.employment_status,
  r.department,
  r.employment_type,
  r.state,
  r.rating_overall,
  r.rating_pay,
  r.rating_work_life,
  r.rating_management,
  r.rating_culture,
  r.rating_growth,
  r.salary_on_time,
  r.overtime_paid,
  r.has_hmo,
  r.pension_remitted,
  r.got_contract,
  r.probation_months,
  r.confirmed_after_probation,
  r.headline,
  r.pros,
  r.cons,
  r.advice_to_management,
  'Q' || extract(quarter from r.publish_at at time zone 'Africa/Lagos')::int
    || ' ' || extract(year from r.publish_at at time zone 'Africa/Lagos')::int as published_quarter,
  (select count(*) from public.review_helpful h where h.review_id = r.id)::int as helpful_count
from public.reviews r
join public.companies c on c.id = r.company_id and c.status = 'active'
where r.status = 'published'
  and r.publish_at <= now();

revoke all on table public.public_reviews from anon, authenticated;
grant select on table public.public_reviews to anon, authenticated;

-- A page of a company's visible reviews, sorted. Sorting by date happens
-- here so dates never leave the database.
create function public.company_reviews(
  p_company_id uuid,
  p_sort text default 'newest',
  p_limit int default 10,
  p_offset int default 0
) returns setof public.public_reviews
  language sql stable security definer set search_path = ''
as $$
  select pr.*
    from public.public_reviews pr
    join public.reviews r on r.id = pr.id
   where pr.company_id = p_company_id
   order by
     case when p_sort = 'helpful' then pr.helpful_count end desc nulls last,
     case when p_sort = 'lowest' then pr.rating_overall end asc nulls last,
     case when p_sort = 'highest' then pr.rating_overall end desc nulls last,
     r.publish_at desc,
     pr.id
   limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke all on function public.company_reviews(uuid, text, int, int) from public;
grant execute on function public.company_reviews(uuid, text, int, int) to anon, authenticated;

-- Per-company numbers. Ratings show only at >= 3 visible reviews; each
-- Nigeria percentage only at >= 3 answers to that question.
create view public.company_stats
  with (security_barrier = true)
as
with v as (
  select r.* from public.reviews r
   where r.status = 'published' and r.publish_at <= now()
),
agg as (
  select
    c.id, c.name, c.slug, c.industry, c.state, c.city, c.size_range,
    count(v.id)::int as n,
    avg(v.rating_overall) as overall, avg(v.rating_pay) as pay, avg(v.rating_work_life) as work_life,
    avg(v.rating_management) as management, avg(v.rating_culture) as culture, avg(v.rating_growth) as growth,
    count(v.salary_on_time)::int as sot_n, count(*) filter (where v.salary_on_time = 'yes')::int as sot_yes,
    count(v.overtime_paid)::int as otp_n, count(*) filter (where v.overtime_paid = 'yes')::int as otp_yes,
    count(v.has_hmo)::int as hmo_n, count(*) filter (where v.has_hmo = 'yes')::int as hmo_yes,
    count(v.pension_remitted)::int as pen_n, count(*) filter (where v.pension_remitted = 'yes')::int as pen_yes,
    count(v.got_contract)::int as con_n, count(*) filter (where v.got_contract = 'yes')::int as con_yes
  from public.companies c
  left join v on v.company_id = c.id
  where c.status = 'active'
  group by c.id
)
select
  id as company_id, name, slug, industry, state, city, size_range,
  n as review_count,
  case when n >= 3 then round(overall, 1) end as avg_overall,
  case when n >= 3 then round(pay, 1) end as avg_pay,
  case when n >= 3 then round(work_life, 1) end as avg_work_life,
  case when n >= 3 then round(management, 1) end as avg_management,
  case when n >= 3 then round(culture, 1) end as avg_culture,
  case when n >= 3 then round(growth, 1) end as avg_growth,
  sot_n as salary_on_time_answers,
  case when sot_n >= 3 then round(100.0 * sot_yes / sot_n)::int end as salary_on_time_yes_pct,
  otp_n as overtime_paid_answers,
  case when otp_n >= 3 then round(100.0 * otp_yes / otp_n)::int end as overtime_paid_yes_pct,
  hmo_n as has_hmo_answers,
  case when hmo_n >= 3 then round(100.0 * hmo_yes / hmo_n)::int end as has_hmo_yes_pct,
  pen_n as pension_remitted_answers,
  case when pen_n >= 3 then round(100.0 * pen_yes / pen_n)::int end as pension_remitted_yes_pct,
  con_n as got_contract_answers,
  case when con_n >= 3 then round(100.0 * con_yes / con_n)::int end as got_contract_yes_pct
from agg;

revoke all on table public.company_stats from anon, authenticated;
grant select on table public.company_stats to anon, authenticated;

-- Department breakdowns only where a department has >= 10 visible reviews.
create view public.company_department_stats
  with (security_barrier = true)
as
select
  r.company_id,
  r.department,
  count(*)::int as review_count,
  round(avg(r.rating_overall), 1) as avg_overall
from public.reviews r
join public.companies c on c.id = r.company_id and c.status = 'active'
where r.status = 'published' and r.publish_at <= now() and r.department is not null
group by r.company_id, r.department
having count(*) >= 10;

revoke all on table public.company_department_stats from anon, authenticated;
grant select on table public.company_department_stats to anon, authenticated;
