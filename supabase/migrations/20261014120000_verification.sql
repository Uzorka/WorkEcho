-- Slice 6: verified checkmark.
--
-- Rule 10 (CLAUDE.md): the checkmark is earned ONLY by passing verification.
-- * The ONLY code that creates or renews a verification is
--   confirm_company_verification(), and only after the right 6-digit code.
-- * Nobody in the browser can insert or update `verifications`.
--   create_verification_challenge() can only be called by the server (service role).
-- * Admins can only revoke (admin_revoke_verification). There is no grant function.
-- * The work email is never stored: the server checks its domain, sends the
--   code, and forgets it. The database only ever sees the domain (to check it
--   matches the company) and a bcrypt hash of the code.
-- * Nothing is connected to payments.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- company email domains

-- Free/consumer email providers can never be a company's work domain.
create function public.is_free_email_domain(d text) returns boolean
  language sql immutable set search_path = ''
as $$
  select lower(d) in (
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
    'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'msn.com', 'icloud.com', 'me.com',
    'mac.com', 'aol.com', 'protonmail.com', 'proton.me', 'mail.com', 'gmx.com', 'gmx.net',
    'yandex.com', 'zoho.com', 'zohomail.com', 'tutanota.com', 'fastmail.com', 'hey.com', 'qq.com',
    '163.com', 'inbox.com'
  );
$$;

create function public.valid_email_domains(d text[]) returns boolean
  language sql immutable set search_path = ''
as $$
  select coalesce(bool_and(
    x ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' and not public.is_free_email_domain(x)
  ), true)
  from unnest(d) x;
$$;

alter table public.companies add column email_domains text[] not null default '{}';
alter table public.companies add constraint companies_email_domains_valid
  check (cardinality(email_domains) <= 10 and public.valid_email_domains(email_domains));

-- True if `email_domain` is one of the company's domains or a subdomain of one
-- (staff@lagos.chfheron.com matches chfheron.com).
create function public.domain_matches_company(p_company_id uuid, p_email_domain text) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.companies c, unnest(c.email_domains) d
     where c.id = p_company_id and c.status = 'active'
       and (lower(p_email_domain) = d or lower(p_email_domain) like '%.' || d)
  );
$$;
revoke all on function public.domain_matches_company(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- tables

create type public.verification_status as enum ('active', 'expired', 'revoked');

-- A pending code. No email, no domain: just who, which company, the code's hash,
-- when it expires and how many wrong guesses so far.
create table public.verification_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  code_hash text not null,
  attempts smallint not null default 0 check (attempts between 0 and 5),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index verification_challenges_user_idx on public.verification_challenges (user_id, created_at desc);
alter table public.verification_challenges enable row level security;
revoke all on table public.verification_challenges from anon, authenticated;

-- Private: users can see only their own rows (for /me); nobody can write from the browser.
create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status public.verification_status not null default 'active',
  revoked_at timestamptz,
  constraint one_verification_per_user_company unique (user_id, company_id)
);
create index verifications_user_idx on public.verifications (user_id, status, expires_at);
alter table public.verifications enable row level security;
revoke all on table public.verifications from anon, authenticated;
grant select (id, company_id, verified_at, expires_at, status) on table public.verifications to authenticated;
create policy "Users read their own verifications"
  on public.verifications for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- checks used everywhere

-- Any active, unexpired verification (the checkmark). Says nothing about which company.
create function public.has_active_verification(p_user_id uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1 from public.verifications v
     where v.user_id = p_user_id and v.status = 'active' and v.expires_at > now()
  );
$$;

revoke all on function public.has_active_verification(uuid) from public, anon, authenticated;

create function public.is_verified_at(p_user_id uuid, p_company_id uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select p_user_id is not null and exists (
    select 1 from public.verifications v
     where v.user_id = p_user_id and v.company_id = p_company_id
       and v.status = 'active' and v.expires_at > now()
  );
$$;
revoke all on function public.is_verified_at(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------- verified content

alter table public.reviews add column is_verified boolean not null default false;
alter table public.salary_reports add column is_verified boolean not null default false;
alter table public.interview_reports add column is_verified boolean not null default false;

-- Set by the database, never by the user (the column isn't in any user grant).
create function public.set_content_verified() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  new.is_verified := public.is_verified_at(new.author_id, new.company_id);
  return new;
end;
$$;
create trigger reviews_set_verified before insert on public.reviews
  for each row execute function public.set_content_verified();
create trigger salary_reports_set_verified before insert on public.salary_reports
  for each row execute function public.set_content_verified();
create trigger interview_reports_set_verified before insert on public.interview_reports
  for each row execute function public.set_content_verified();

-- Mark (or unmark) everything a user wrote about a company.
create function public.set_user_company_content_verified(p_user_id uuid, p_company_id uuid, p_value boolean)
  returns void
  language sql security definer set search_path = ''
as $$
  update public.reviews set is_verified = p_value where author_id = p_user_id and company_id = p_company_id;
  update public.salary_reports set is_verified = p_value where author_id = p_user_id and company_id = p_company_id;
  update public.interview_reports set is_verified = p_value where author_id = p_user_id and company_id = p_company_id;
$$;
revoke all on function public.set_user_company_content_verified(uuid, uuid, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------- the verification flow

-- Step 1 (server only, after it has checked the email and BEFORE it sends the code).
-- Returns 'sent' | 'not_allowed' | 'free_domain' | 'wrong_domain' | 'revoked' | 'already_verified' | 'too_many'.
create function public.create_verification_challenge(p_user_id uuid, p_company_id uuid, p_email_domain text, p_code text)
  returns text
  language plpgsql security definer set search_path = ''
as $$
declare
  existing record;
begin
  if p_code !~ '^[0-9]{6}$' then
    raise exception 'bad code format';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id and onboarded_at is not null and not is_banned) then
    return 'not_allowed';
  end if;
  if public.is_free_email_domain(p_email_domain) then
    return 'free_domain';
  end if;
  if not public.domain_matches_company(p_company_id, p_email_domain) then
    return 'wrong_domain';
  end if;

  select * into existing from public.verifications where user_id = p_user_id and company_id = p_company_id;
  if existing.status = 'revoked' then
    return 'revoked';
  end if;
  -- Renewal opens 30 days before expiry.
  if existing.status = 'active' and existing.expires_at > now() + interval '30 days' then
    return 'already_verified';
  end if;

  -- 3 attempts (codes sent) per account per day.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':verify', 0));
  if (select count(*) from public.verification_challenges
       where user_id = p_user_id and created_at > now() - interval '1 day') >= 3 then
    return 'too_many';
  end if;

  -- Only the newest code works.
  update public.verification_challenges set used_at = now() where user_id = p_user_id and used_at is null;
  insert into public.verification_challenges (user_id, company_id, code_hash, expires_at)
  values (p_user_id, p_company_id, extensions.crypt(p_code, extensions.gen_salt('bf', 8)), now() + interval '15 minutes');
  return 'sent';
end;
$$;
revoke all on function public.create_verification_challenge(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_verification_challenge(uuid, uuid, text, text) to service_role;

-- Step 2 (the signed-in user). The ONLY place a checkmark is created or renewed.
-- Returns {"status": "verified" | "wrong_code" | "expired" | "too_many_attempts" | "revoked", "attempts_left"?: n}.
create function public.confirm_company_verification(p_code text)
  returns jsonb
  language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  ch record;
begin
  if uid is null or not public.can_contribute() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select * into ch from public.verification_challenges
   where user_id = uid and used_at is null
   order by created_at desc limit 1
   for update;
  if ch.id is null or ch.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;
  if ch.attempts >= 5 then
    return jsonb_build_object('status', 'too_many_attempts');
  end if;
  if coalesce(p_code, '') !~ '^[0-9]{6}$' or extensions.crypt(p_code, ch.code_hash) <> ch.code_hash then
    update public.verification_challenges set attempts = attempts + 1 where id = ch.id;
    if ch.attempts + 1 >= 5 then
      return jsonb_build_object('status', 'too_many_attempts');
    end if;
    return jsonb_build_object('status', 'wrong_code', 'attempts_left', 5 - (ch.attempts + 1));
  end if;

  update public.verification_challenges set used_at = now() where id = ch.id;
  if exists (select 1 from public.verifications where user_id = uid and company_id = ch.company_id and status = 'revoked') then
    return jsonb_build_object('status', 'revoked');
  end if;

  insert into public.verifications (user_id, company_id, verified_at, expires_at, status)
  values (uid, ch.company_id, now(), now() + interval '12 months', 'active')
  on conflict (user_id, company_id) do update
     set verified_at = now(), expires_at = now() + interval '12 months', status = 'active';

  -- Anything they already wrote about this company counts as verified too.
  perform public.set_user_company_content_verified(uid, ch.company_id, true);
  return jsonb_build_object('status', 'verified');
end;
$$;
revoke all on function public.confirm_company_verification(text) from public, anon;
grant execute on function public.confirm_company_verification(text) to authenticated;

-- Keeps the stored status honest (the checkmark itself already ignores expired rows).
create function public.mark_expired_verifications() returns void
  language sql security definer set search_path = ''
as $$
  update public.verifications set status = 'expired' where status = 'active' and expires_at <= now();
$$;
revoke all on function public.mark_expired_verifications() from public, anon, authenticated;

-- ---------------------------------------------------------------- revoking

create function public.revoke_verification_internal(p_id uuid, p_admin uuid, p_note text) returns boolean
  language plpgsql security definer set search_path = ''
as $$
declare
  v record;
begin
  update public.verifications set status = 'revoked', revoked_at = now()
   where id = p_id and status <> 'revoked'
  returning * into v;
  if v.id is null then
    return false;
  end if;
  perform public.set_user_company_content_verified(v.user_id, v.company_id, false);
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values (p_admin, 'verification_revoke', 'verification', p_id::text, p_note);
  return true;
end;
$$;
revoke all on function public.revoke_verification_internal(uuid, uuid, text) from public, anon, authenticated;

-- Admins can revoke. (There is deliberately no admin function to grant.)
create function public.admin_revoke_verification(p_id uuid, p_note text default null) returns void
  language plpgsql security definer set search_path = ''
as $$
declare
  admin uuid := public.require_admin();
begin
  if not public.revoke_verification_internal(p_id, admin, nullif(btrim(coalesce(p_note, '')), '')) then
    raise exception 'not found or already revoked' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.admin_revoke_verification(uuid, text) from public, anon;
grant execute on function public.admin_revoke_verification(uuid, text) to authenticated;

create function public.admin_verifications(p_query text default '')
  returns table (id uuid, pseudonym text, company_name text, company_slug text, verified_at timestamptz,
                 expires_at timestamptz, status text)
  language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.require_admin();
  return query
  select v.id, p.pseudonym, c.name, c.slug, v.verified_at, v.expires_at,
         case when v.status = 'active' and v.expires_at <= now() then 'expired' else v.status::text end
    from public.verifications v
    join public.profiles p on p.id = v.user_id
    join public.companies c on c.id = v.company_id
   where coalesce(p_query, '') = ''
      or p.pseudonym ilike '%' || p_query || '%'
      or c.name ilike '%' || p_query || '%'
   order by v.verified_at desc
   limit 100;
end;
$$;
revoke all on function public.admin_verifications(text) from public, anon;
grant execute on function public.admin_verifications(text) to authenticated;

-- Banning someone revokes their checkmarks automatically (logged).
create function public.revoke_verifications_on_ban() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare
  v record;
begin
  if new.is_banned and not old.is_banned then
    for v in select id from public.verifications where user_id = new.id and status <> 'revoked' loop
      perform public.revoke_verification_internal(v.id, auth.uid(), 'Automatic: account banned');
    end loop;
  end if;
  return new;
end;
$$;
create trigger profiles_revoke_verifications_on_ban
  after update of is_banned on public.profiles
  for each row execute function public.revoke_verifications_on_ban();

-- ---------------------------------------------------------------- verified users: double rate limits

create or replace function public.enforce_rate_limit(p_action text, p_max int, p_window interval, p_message text)
  returns void
  language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  allowed int := p_max;
begin
  if uid is null then
    return;
  end if;
  -- Verified users get double the limit.
  if public.has_active_verification(uid) then
    allowed := p_max * 2;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_action, 0));
  if (select count(*) from public.rate_limit_events
       where user_id = uid and action = p_action and created_at > now() - p_window) >= allowed then
    raise exception '%', replace(p_message, '{max}', allowed::text) using errcode = 'P0429';
  end if;
  insert into public.rate_limit_events (user_id, action) values (uid, p_action);
end;
$$;

create or replace function public.rate_limit_posts() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  perform public.enforce_rate_limit('post', 5, interval '1 hour', 'You can write up to {max} posts an hour. Please try again a bit later.');
  return new;
end;
$$;

create or replace function public.rate_limit_replies() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  perform public.enforce_rate_limit('reply', 30, interval '1 hour', 'You can write up to {max} replies an hour. Please try again a bit later.');
  return new;
end;
$$;

create or replace function public.rate_limit_reviews() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  perform public.enforce_rate_limit('review', 3, interval '1 day', 'You can write up to {max} reviews a day. Please come back tomorrow.');
  return new;
end;
$$;

-- report_content() calls enforce_rate_limit('report', 10, ...) with a fixed message; give it the placeholder too.

create or replace function public.report_content(
  p_type public.report_content_type,
  p_id uuid,
  p_reason public.report_reason,
  p_details text default null,
  p_role_group public.department default null,
  p_level public.salary_level default null
) returns jsonb
  language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  info record;
  key text;
  ctx jsonb;
  open_reporters int;
begin
  if uid is null or not public.can_contribute() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  p_details := nullif(btrim(coalesce(p_details, '')), '');
  if p_details is not null and char_length(p_details) > 1000 then
    return jsonb_build_object('status', 'invalid');
  end if;

  if p_type = 'salary_group' then
    if p_role_group is null or p_level is null or not exists (
      select 1 from public.company_salary_stats s
       where s.company_id = p_id and s.role_group = p_role_group and s.level = p_level
    ) then
      return jsonb_build_object('status', 'not_found');
    end if;
    key := p_id::text || ':' || p_role_group::text || ':' || p_level::text;
    ctx := jsonb_build_object('role_group', p_role_group, 'level', p_level);
  else
    select * into info from public.content_info(p_type, p_id);
    if info.status is null or not info.visible then
      return jsonb_build_object('status', 'not_found');
    end if;
    if info.author_id = uid then
      return jsonb_build_object('status', 'own');
    end if;
    key := p_id::text;
  end if;

  if exists (select 1 from public.reports where content_type = p_type and content_key = key and reporter_id = uid) then
    return jsonb_build_object('status', 'already_reported');
  end if;

  perform public.enforce_rate_limit('report', 10, interval '1 hour', 'You can send up to {max} reports an hour. Please try again a bit later.');

  insert into public.reports (content_type, content_id, content_key, context, reporter_id, reason, details)
  values (p_type, p_id, key, ctx, uid, p_reason, p_details);

  -- Auto-hide at 3 open reports from different people (not for salary groups,
  -- which are aggregates: an admin looks at the individual amounts).
  if p_type <> 'salary_group' then
    select count(distinct reporter_id) into open_reporters
      from public.reports where content_type = p_type and content_key = key and status = 'open';
    if open_reporters >= 3 and info.status = 'published' then
      perform public.set_content_status(p_type, p_id, 'hidden');
      insert into public.admin_actions (admin_id, action, target_type, target_id, note)
      values (null, 'auto_hide', p_type::text, p_id::text, '3 or more reports; hidden pending review');
    end if;
  end if;

  return jsonb_build_object('status', 'reported');
end;
$$;

-- ---------------------------------------------------------------- public views (new columns appended)

-- is_verified = has any active checkmark. Never which company.
create or replace view public.public_profiles
  with (security_barrier = true)
  as select pr.pseudonym,
            exists (select 1 from public.verifications vv
                     where vv.user_id = pr.id and vv.status = 'active' and vv.expires_at > now()) as is_verified
       from public.profiles pr;

create or replace view public.public_reviews
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
  (select count(*) from public.review_helpful h where h.review_id = r.id)::int as helpful_count,
  r.is_verified
from public.reviews r
join public.companies c on c.id = r.company_id and c.status = 'active'
where r.status = 'published'
  and r.publish_at <= now();

create or replace view public.public_interview_reports
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
    || ' ' || extract(year from i.publish_at at time zone 'Africa/Lagos')::int as published_quarter,
  i.is_verified
from public.interview_reports i
join public.companies c on c.id = i.company_id and c.status = 'active'
where i.status = 'published' and i.publish_at <= now();

create or replace view public.company_salary_stats
  with (security_barrier = true)
as
select
  s.company_id,
  s.role_group,
  s.level,
  count(*)::int as report_count,
  (round((percentile_cont(0.5) within group (order by s.monthly_gross_naira))::numeric / 10000) * 10000)::int as median_naira,
  (round(min(s.monthly_gross_naira)::numeric / 10000) * 10000)::int as lowest_naira,
  (round(max(s.monthly_gross_naira)::numeric / 10000) * 10000)::int as highest_naira,
  (count(*) filter (where s.is_verified))::int as verified_count
from public.salary_reports s
join public.companies c on c.id = s.company_id and c.status = 'active'
where s.status = 'published' and s.publish_at <= now()
group by s.company_id, s.role_group, s.level
having count(*) >= 3;

create or replace view public.public_posts
  with (security_barrier = true)
as
select
  p.id,
  p.company_id,
  c.name as company_name,
  c.slug as company_slug,
  p.category,
  p.body,
  p.created_at,
  p.edited_at,
  coalesce(pr.pseudonym, 'Deleted user') as author_pseudonym,
  (select count(*) from public.post_likes l where l.post_id = p.id)::int as like_count,
  (select count(*) from public.replies r where r.post_id = p.id and r.status = 'published')::int as reply_count,
  -- Per-viewer flags. auth.uid() is the requester, so nothing leaks.
  coalesce(p.author_id = auth.uid(), false) as is_mine,
  exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()) as liked_by_me,
  -- Checkmark: author has any active verification. Never says which company.
  exists (select 1 from public.verifications vv where vv.user_id = p.author_id and vv.status = 'active' and vv.expires_at > now()) as author_is_verified,
  -- "Top this week" score: likes, plus 1 for verified authors (a modest boost,
  -- worth one extra like). Kept as an integer so cursor pagination stays exact.
  ((select count(*) from public.post_likes l where l.post_id = p.id)
     + case when exists (select 1 from public.verifications vv where vv.user_id = p.author_id and vv.status = 'active' and vv.expires_at > now()) then 1 else 0 end)::int as rank_score
from public.posts p
left join public.profiles pr on pr.id = p.author_id
left join public.companies c on c.id = p.company_id and c.status = 'active'
where p.status = 'published';

create or replace view public.public_replies
  with (security_barrier = true)
as
select
  r.id,
  r.post_id,
  r.body,
  r.created_at,
  r.edited_at,
  coalesce(pr.pseudonym, 'Deleted user') as author_pseudonym,
  coalesce(r.author_id = auth.uid(), false) as is_mine,
  exists (select 1 from public.verifications vv where vv.user_id = r.author_id and vv.status = 'active' and vv.expires_at > now()) as author_is_verified
from public.replies r
join public.posts p on p.id = r.post_id and p.status = 'published'
left join public.profiles pr on pr.id = r.author_id
where r.status = 'published';

-- ---------------------------------------------------------------- weighted company stats
-- Verified reviews count twice (weight 2), others once (weight 1):
--   average = sum(weight * rating) / sum(weight)
--   % yes   = sum(weight of "yes" answers) / sum(weight of all answers to that question)
-- Thresholds (>= 3) still use the plain number of reviews / answers.
create or replace view public.company_stats
  with (security_barrier = true)
as
with v as (
  select r.*, case when r.is_verified then 2 else 1 end as w
    from public.reviews r
   where r.status = 'published' and r.publish_at <= now()
),
agg as (
  select
    c.id, c.name, c.slug, c.industry, c.state, c.city, c.size_range,
    count(v.id)::int as n,
    count(v.id) filter (where v.is_verified)::int as n_verified,
    sum(v.w * v.rating_overall)::numeric / nullif(sum(v.w), 0) as overall,
    sum(v.w * v.rating_pay)::numeric / nullif(sum(v.w), 0) as pay,
    sum(v.w * v.rating_work_life)::numeric / nullif(sum(v.w), 0) as work_life,
    sum(v.w * v.rating_management)::numeric / nullif(sum(v.w), 0) as management,
    sum(v.w * v.rating_culture)::numeric / nullif(sum(v.w), 0) as culture,
    sum(v.w * v.rating_growth)::numeric / nullif(sum(v.w), 0) as growth,
    count(v.salary_on_time)::int as sot_n,
    sum(v.w) filter (where v.salary_on_time = 'yes')::numeric / nullif(sum(v.w) filter (where v.salary_on_time is not null), 0) as sot_share,
    count(v.overtime_paid)::int as otp_n,
    sum(v.w) filter (where v.overtime_paid = 'yes')::numeric / nullif(sum(v.w) filter (where v.overtime_paid is not null), 0) as otp_share,
    count(v.has_hmo)::int as hmo_n,
    sum(v.w) filter (where v.has_hmo = 'yes')::numeric / nullif(sum(v.w) filter (where v.has_hmo is not null), 0) as hmo_share,
    count(v.pension_remitted)::int as pen_n,
    sum(v.w) filter (where v.pension_remitted = 'yes')::numeric / nullif(sum(v.w) filter (where v.pension_remitted is not null), 0) as pen_share,
    count(v.got_contract)::int as con_n,
    sum(v.w) filter (where v.got_contract = 'yes')::numeric / nullif(sum(v.w) filter (where v.got_contract is not null), 0) as con_share
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
  case when sot_n >= 3 then round(100 * coalesce(sot_share, 0))::int end as salary_on_time_yes_pct,
  otp_n as overtime_paid_answers,
  case when otp_n >= 3 then round(100 * coalesce(otp_share, 0))::int end as overtime_paid_yes_pct,
  hmo_n as has_hmo_answers,
  case when hmo_n >= 3 then round(100 * coalesce(hmo_share, 0))::int end as has_hmo_yes_pct,
  pen_n as pension_remitted_answers,
  case when pen_n >= 3 then round(100 * coalesce(pen_share, 0))::int end as pension_remitted_yes_pct,
  con_n as got_contract_answers,
  case when con_n >= 3 then round(100 * coalesce(con_share, 0))::int end as got_contract_yes_pct,
  n_verified as verified_review_count
from agg;

-- ---------------------------------------------------------------- lists: verified first, then the chosen sort

drop function public.company_reviews(uuid, text, int, int);
create function public.company_reviews(
  p_company_id uuid,
  p_sort text default 'newest',
  p_limit int default 10,
  p_offset int default 0,
  p_verified_only boolean default false
) returns setof public.public_reviews
  language sql stable security definer set search_path = ''
as $$
  select pr.*
    from public.public_reviews pr
    join public.reviews r on r.id = pr.id
   where pr.company_id = p_company_id
     and (not p_verified_only or pr.is_verified)
   order by
     pr.is_verified desc,
     case when p_sort = 'helpful' then pr.helpful_count end desc nulls last,
     case when p_sort = 'lowest' then pr.rating_overall end asc nulls last,
     case when p_sort = 'highest' then pr.rating_overall end desc nulls last,
     r.publish_at desc,
     pr.id
   limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke all on function public.company_reviews(uuid, text, int, int, boolean) from public;
grant execute on function public.company_reviews(uuid, text, int, int, boolean) to anon, authenticated;

drop function public.company_interviews(uuid, int, int);
create function public.company_interviews(p_company_id uuid, p_limit int default 10, p_offset int default 0)
  returns setof public.public_interview_reports
  language sql stable security definer set search_path = ''
as $$
  select pi.*
    from public.public_interview_reports pi
    join public.interview_reports i on i.id = pi.id
   where pi.company_id = p_company_id
   order by pi.is_verified desc, i.publish_at desc, pi.id
   limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke all on function public.company_interviews(uuid, int, int) from public;
grant execute on function public.company_interviews(uuid, int, int) to anon, authenticated;

-- ---------------------------------------------------------------- feed: "Top this week" uses rank_score

drop function public.feed_posts(text, public.post_category, uuid, timestamptz, uuid, int, int);
-- latest: newest first; cursor = (created_at, id).
-- top:    last 7 days, highest rank_score first; cursor = (rank_score, created_at, id).
--         rank_score = likes + 1 if the author is verified (see public_posts).
create function public.feed_posts(
  p_sort text default 'latest',
  p_category public.post_category default null,
  p_company_id uuid default null,
  p_after_created timestamptz default null,
  p_after_id uuid default null,
  p_after_score int default null,
  p_limit int default 10
) returns setof public.public_posts
  language sql stable set search_path = ''
as $$
  select pp.*
    from public.public_posts pp
   where (p_category is null or pp.category = p_category)
     and (p_company_id is null or pp.company_id = p_company_id)
     and (
       case when p_sort = 'top' then
         pp.created_at > now() - interval '7 days'
         and (p_after_id is null
              or (pp.rank_score, pp.created_at, pp.id) < (p_after_score, p_after_created, p_after_id))
       else
         p_after_id is null or (pp.created_at, pp.id) < (p_after_created, p_after_id)
       end
     )
   order by
     case when p_sort = 'top' then pp.rank_score end desc nulls last,
     pp.created_at desc,
     pp.id desc
   limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;
grant execute on function public.feed_posts(text, public.post_category, uuid, timestamptz, uuid, int, int) to anon, authenticated;

-- ---------------------------------------------------------------- admin: company email domains

drop function public.admin_companies(text, uuid);
create function public.admin_companies(p_query text default '', p_id uuid default null)
  returns table (id uuid, name text, slug text, industry text, state text, city text, website text,
                 size_range text, description text, status text, email_domains text[])
  language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.require_admin();
  return query
  select c.id, c.name, c.slug, c.industry, c.state, c.city, c.website, c.size_range, c.description, c.status::text, c.email_domains
    from public.companies c
   where (p_id is not null and c.id = p_id)
      or (p_id is null and (coalesce(p_query, '') = '' or c.name ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'))
   order by c.name
   limit 50;
end;
$$;
revoke all on function public.admin_companies(text, uuid) from public, anon;
grant execute on function public.admin_companies(text, uuid) to authenticated;

drop function public.admin_update_company(uuid, text, text, text, text, text, text, text, text, text);
create function public.admin_update_company(
  p_id uuid, p_name text, p_industry text, p_state text, p_city text, p_website text,
  p_size_range text, p_description text, p_status text, p_email_domains text[] default '{}', p_note text default null
) returns void
  language plpgsql security definer set search_path = ''
as $$
declare
  admin uuid := public.require_admin();
begin
  update public.companies
     set name = btrim(p_name), industry = p_industry, state = nullif(p_state, ''),
         city = nullif(btrim(coalesce(p_city, '')), ''), website = nullif(btrim(coalesce(p_website, '')), ''),
         size_range = nullif(p_size_range, ''), description = nullif(btrim(coalesce(p_description, '')), ''),
         status = p_status::public.company_status,
         email_domains = coalesce((select array_agg(distinct lower(btrim(d))) from unnest(p_email_domains) d where btrim(d) <> ''), '{}')
   where id = p_id;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values (admin, 'company_update', 'company', p_id::text, nullif(btrim(coalesce(p_note, '')), ''));
end;
$$;
revoke all on function public.admin_update_company(uuid, text, text, text, text, text, text, text, text, text[], text) from public, anon;
grant execute on function public.admin_update_company(uuid, text, text, text, text, text, text, text, text, text[], text) to authenticated;
