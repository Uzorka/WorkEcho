-- Slice 5: safety, moderation and admin.
--
-- * Contact details (emails, Nigerian phone numbers) are blocked by CHECK
--   constraints on every free-text column, so direct API writes can't skip it.
-- * Rate limits are enforced by triggers (per account, server-side).
-- * reports: filed only through report_content(); 3 open reports from
--   different users auto-hide the item pending admin review.
-- * Every admin read/write is a SECURITY DEFINER function that checks
--   is_admin() itself and writes admin_actions. Nothing here trusts the app.

-- ---------------------------------------------------------------- contact details

-- True if the text contains an email address or a Nigerian phone number
-- (+234 or 0 followed by 10 digits; spaces, dots and dashes between digits ignored).
create function public.has_contact_details(t text) returns boolean
  language sql immutable set search_path = ''
as $$
  select t is not null and (
    t ~* '[^[:space:]@]+@[^[:space:]@]+\.[a-z]{2,}'
    or regexp_replace(t, '([0-9])[[:space:].-]+(?=[0-9])', '\1', 'g') ~ '(\+?234|(^|[^0-9])0)[0-9]{10}([^0-9]|$)'
  );
$$;

alter table public.posts add constraint posts_no_contact_details check (not public.has_contact_details(body));
alter table public.replies add constraint replies_no_contact_details check (not public.has_contact_details(body));
alter table public.reviews add constraint reviews_no_contact_details check (
  not public.has_contact_details(headline) and not public.has_contact_details(pros)
  and not public.has_contact_details(cons) and not public.has_contact_details(advice_to_management)
);
alter table public.interview_reports add constraint interview_reports_no_contact_details check (
  not public.has_contact_details(questions_asked) and not public.has_contact_details(tips)
);
alter table public.company_requests add constraint company_requests_no_contact_details check (not public.has_contact_details(name));

-- ---------------------------------------------------------------- rate limits

-- One row per write that counts towards a limit. Kept even if the content is
-- deleted, so deleting doesn't reset the limit. Not readable by users.
create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_lookup_idx on public.rate_limit_events (user_id, action, created_at desc);
alter table public.rate_limit_events enable row level security;
revoke all on table public.rate_limit_events from anon, authenticated;

-- Raises SQLSTATE P0429 with a friendly message when over the limit.
create function public.enforce_rate_limit(p_action text, p_max int, p_window interval, p_message text)
  returns void
  language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  -- Seeds and admin/service-role writes have no auth.uid(): no limit.
  if uid is null then
    return;
  end if;
  -- Serialise per user+action so parallel requests can't slip past the count.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_action, 0));
  if (select count(*) from public.rate_limit_events
       where user_id = uid and action = p_action and created_at > now() - p_window) >= p_max then
    raise exception '%', p_message using errcode = 'P0429';
  end if;
  insert into public.rate_limit_events (user_id, action) values (uid, p_action);
end;
$$;
revoke all on function public.enforce_rate_limit(text, int, interval, text) from public, anon, authenticated;

create function public.rate_limit_posts() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  perform public.enforce_rate_limit('post', 5, interval '1 hour', 'You can write up to 5 posts an hour. Please try again a bit later.');
  return new;
end;
$$;
create trigger posts_rate_limit before insert on public.posts for each row execute function public.rate_limit_posts();

create function public.rate_limit_replies() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  perform public.enforce_rate_limit('reply', 30, interval '1 hour', 'You can write up to 30 replies an hour. Please try again a bit later.');
  return new;
end;
$$;
create trigger replies_rate_limit before insert on public.replies for each row execute function public.rate_limit_replies();

create function public.rate_limit_reviews() returns trigger
  language plpgsql security definer set search_path = ''
as $$
begin
  perform public.enforce_rate_limit('review', 3, interval '1 day', 'You can write up to 3 reviews a day. Please come back tomorrow.');
  return new;
end;
$$;
create trigger reviews_rate_limit before insert on public.reviews for each row execute function public.rate_limit_reviews();

-- ---------------------------------------------------------------- banned users: read, but not write

-- Writes already require can_contribute() (onboarded, not banned). Editing
-- existing content must also stop when banned. Deleting your own stays allowed.
create function public.not_banned() returns boolean
  language sql stable security definer set search_path = ''
as $$
  select not exists (select 1 from public.profiles where id = auth.uid() and is_banned);
$$;
revoke all on function public.not_banned() from public, anon;
grant execute on function public.not_banned() to authenticated;

alter policy "Authors edit their own reviews unless removed" on public.reviews
  using (author_id = (select auth.uid()) and status <> 'removed' and (select public.not_banned()));
alter policy "Authors edit their own salary reports unless removed" on public.salary_reports
  using (author_id = (select auth.uid()) and status <> 'removed' and (select public.not_banned()));
alter policy "Authors edit their own interview reports unless removed" on public.interview_reports
  using (author_id = (select auth.uid()) and status <> 'removed' and (select public.not_banned()));
alter policy "Authors edit their own posts unless removed" on public.posts
  using (author_id = (select auth.uid()) and status <> 'removed' and (select public.not_banned()));
alter policy "Authors edit their own replies unless removed" on public.replies
  using (author_id = (select auth.uid()) and status <> 'removed' and (select public.not_banned()));

-- ---------------------------------------------------------------- notifications: moderation warnings

alter type public.notification_type add value if not exists 'moderation_warning';
alter table public.notifications alter column post_id drop not null;
alter table public.notifications add column message text check (char_length(message) <= 1000);
grant select (message) on table public.notifications to authenticated;

-- ---------------------------------------------------------------- reports

create type public.report_content_type as enum ('post', 'reply', 'review', 'interview', 'salary_group');
create type public.report_reason as enum (
  'personal_info', 'fake_misleading', 'harassment_threat', 'names_individual', 'spam', 'other'
);
create type public.report_status as enum ('open', 'dismissed', 'actioned');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  content_type public.report_content_type not null,
  -- The item's id. For salary_group: the company id (see context).
  content_id uuid not null,
  -- Identifies the item uniquely: content_id, or company:role_group:level for salary groups.
  content_key text not null,
  -- salary_group only: {"role_group": ..., "level": ...}
  context jsonb,
  reporter_id uuid references public.profiles (id) on delete set null,
  reason public.report_reason not null,
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint one_report_per_user_per_item unique (content_type, content_key, reporter_id)
);
create index reports_open_idx on public.reports (status, content_type, content_key);

alter table public.reports enable row level security;
-- No direct access for anyone in the browser. Reporters are visible only to
-- admins, through the admin_* functions below.
revoke all on table public.reports from anon, authenticated;

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  -- Null for automatic actions (auto-hide).
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);
create index admin_actions_created_idx on public.admin_actions (created_at desc);
alter table public.admin_actions enable row level security;
revoke all on table public.admin_actions from anon, authenticated;

create function public.is_admin() returns boolean
  language sql stable security definer set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;
grant execute on function public.is_admin() to authenticated;

create function public.require_admin() returns uuid
  language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;
revoke all on function public.require_admin() from public, anon, authenticated;

-- Status and author of any reportable item (internal helper).
create function public.content_info(p_type public.report_content_type, p_id uuid, out status text, out author_id uuid, out visible boolean)
  language plpgsql stable security definer set search_path = ''
as $$
begin
  case p_type
    when 'post' then
      select p.status::text, p.author_id, p.status = 'published' into status, author_id, visible
        from public.posts p where p.id = p_id;
    when 'reply' then
      select r.status::text, r.author_id, r.status = 'published' and p.status = 'published' into status, author_id, visible
        from public.replies r join public.posts p on p.id = r.post_id where r.id = p_id;
    when 'review' then
      select r.status::text, r.author_id, r.status = 'published' and r.publish_at <= now() into status, author_id, visible
        from public.reviews r where r.id = p_id;
    when 'interview' then
      select i.status::text, i.author_id, i.status = 'published' and i.publish_at <= now() into status, author_id, visible
        from public.interview_reports i where i.id = p_id;
    else
      status := null; author_id := null; visible := null;
  end case;
end;
$$;
revoke all on function public.content_info(public.report_content_type, uuid) from public, anon, authenticated;

-- Sets the moderation status of an item (internal helper).
create function public.set_content_status(p_type public.report_content_type, p_id uuid, p_status public.review_status)
  returns void
  language plpgsql security definer set search_path = ''
as $$
begin
  case p_type
    when 'post' then update public.posts set status = p_status where id = p_id;
    when 'reply' then update public.replies set status = p_status where id = p_id;
    when 'review' then update public.reviews set status = p_status where id = p_id;
    when 'interview' then update public.interview_reports set status = p_status where id = p_id;
    else raise exception 'unsupported content type';
  end case;
end;
$$;
revoke all on function public.set_content_status(public.report_content_type, uuid, public.review_status) from public, anon, authenticated;

-- File a report. Returns {"status": "reported" | "already_reported" | "own" | "not_found" | "invalid"}.
-- Rate limited (10/hour). Auto-hides an item at 3 open reports from different users.
create function public.report_content(
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

  perform public.enforce_rate_limit('report', 10, interval '1 hour', 'You can send up to 10 reports an hour. Please try again a bit later.');

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
revoke all on function public.report_content(public.report_content_type, uuid, public.report_reason, text, public.department, public.salary_level) from public, anon;
grant execute on function public.report_content(public.report_content_type, uuid, public.report_reason, text, public.department, public.salary_level) to authenticated;

-- ---------------------------------------------------------------- admin: reports queue

create function public.admin_reports_queue(p_status text default 'open')
  returns table (
    content_type public.report_content_type,
    content_key text,
    content_id uuid,
    context jsonb,
    content_status text,
    preview text,
    company_name text,
    company_slug text,
    author_id uuid,
    author_pseudonym text,
    report_count int,
    open_count int,
    reasons text[],
    details text[],
    reporters text[],
    last_reported timestamptz
  )
  language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.require_admin();
  return query
  with g as (
    select r.content_type, r.content_key, min(r.content_id::text)::uuid as content_id, (array_agg(r.context))[1] as context,
           count(*)::int as report_count,
           count(*) filter (where r.status = 'open')::int as open_count,
           array_agg(distinct r.reason::text) as reasons,
           array_remove(array_agg(r.details order by r.created_at), null) as details,
           array_agg(coalesce(p.pseudonym, 'Deleted user') order by r.created_at) as reporters,
           max(r.created_at) as last_reported
      from public.reports r
      left join public.profiles p on p.id = r.reporter_id
     group by r.content_type, r.content_key
  )
  select g.content_type, g.content_key, g.content_id, g.context,
         coalesce(po.status::text, re.status::text, rv.status::text, iv.status::text, 'n/a') as content_status,
         coalesce(po.body, re.body, rv.headline || E'\n\nPros: ' || rv.pros || E'\n\nCons: ' || rv.cons,
                  iv.questions_asked || coalesce(E'\n\nTips: ' || iv.tips, ''),
                  (g.context ->> 'role_group') || ' / ' || (g.context ->> 'level')) as preview,
         c.name, c.slug,
         coalesce(po.author_id, re.author_id, rv.author_id, iv.author_id) as author_id,
         ap.pseudonym,
         g.report_count, g.open_count, g.reasons, g.details, g.reporters, g.last_reported
    from g
    left join public.posts po on g.content_type = 'post' and po.id = g.content_id
    left join public.replies re on g.content_type = 'reply' and re.id = g.content_id
    left join public.reviews rv on g.content_type = 'review' and rv.id = g.content_id
    left join public.interview_reports iv on g.content_type = 'interview' and iv.id = g.content_id
    left join public.companies c on c.id = coalesce(po.company_id, rv.company_id, iv.company_id,
                                                    case when g.content_type = 'salary_group' then g.content_id end)
    left join public.profiles ap on ap.id = coalesce(po.author_id, re.author_id, rv.author_id, iv.author_id)
   where (p_status = 'open' and g.open_count > 0) or (p_status <> 'open' and g.open_count = 0)
   order by g.open_count desc, g.last_reported desc
   limit 100;
end;
$$;
revoke all on function public.admin_reports_queue(text) from public, anon;
grant execute on function public.admin_reports_queue(text) to authenticated;

-- Individual salaries in a reported group (admins only, to spot fake values).
create function public.admin_salary_group(p_company_id uuid, p_role_group public.department, p_level public.salary_level)
  returns table (id uuid, monthly_gross_naira int, status text, created_at timestamptz, author_pseudonym text)
  language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.require_admin();
  return query
  select s.id, s.monthly_gross_naira, s.status::text, s.created_at, coalesce(p.pseudonym, 'Deleted user')
    from public.salary_reports s left join public.profiles p on p.id = s.author_id
   where s.company_id = p_company_id and s.role_group = p_role_group and s.level = p_level
   order by s.monthly_gross_naira;
end;
$$;
revoke all on function public.admin_salary_group(uuid, public.department, public.salary_level) from public, anon;
grant execute on function public.admin_salary_group(uuid, public.department, public.salary_level) to authenticated;

-- dismiss: reports were unfounded -> close them and un-hide the item if it was hidden.
-- hide / remove: set the item's status, close reports as actioned.
-- restore: publish the item again, close reports.
create function public.admin_moderate(p_type public.report_content_type, p_key text, p_action text, p_note text default null)
  returns void
  language plpgsql security definer set search_path = ''
as $$
declare
  admin uuid := public.require_admin();
  item uuid;
  info record;
begin
  if p_action not in ('dismiss', 'hide', 'remove', 'restore') then
    raise exception 'unknown action';
  end if;
  p_note := nullif(btrim(coalesce(p_note, '')), '');

  if p_type = 'salary_group' then
    if p_action <> 'dismiss' then
      raise exception 'salary groups are moderated per salary report';
    end if;
  else
    item := p_key::uuid;
    select * into info from public.content_info(p_type, item);
    if info.status is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;
    if p_action = 'hide' then
      perform public.set_content_status(p_type, item, 'hidden');
    elsif p_action = 'remove' then
      perform public.set_content_status(p_type, item, 'removed');
    elsif p_action = 'restore' or (p_action = 'dismiss' and info.status = 'hidden') then
      perform public.set_content_status(p_type, item, 'published');
    end if;
  end if;

  update public.reports
     set status = case when p_action in ('hide', 'remove') then 'actioned'::public.report_status else 'dismissed'::public.report_status end,
         resolved_at = now()
   where content_type = p_type and content_key = p_key and status = 'open';

  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values (admin, 'moderate_' || p_action, p_type::text, p_key, p_note);
end;
$$;
revoke all on function public.admin_moderate(public.report_content_type, text, text, text) from public, anon;
grant execute on function public.admin_moderate(public.report_content_type, text, text, text) to authenticated;

-- Hide / remove / restore one salary report (from a reported salary group).
create function public.admin_moderate_salary(p_salary_id uuid, p_action text, p_note text default null)
  returns void
  language plpgsql security definer set search_path = ''
as $$
declare
  admin uuid := public.require_admin();
begin
  if p_action not in ('hide', 'remove', 'restore') then
    raise exception 'unknown action';
  end if;
  update public.salary_reports
     set status = case p_action when 'hide' then 'hidden' when 'remove' then 'removed' else 'published' end::public.review_status
   where id = p_salary_id;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values (admin, 'moderate_' || p_action, 'salary', p_salary_id::text, nullif(btrim(coalesce(p_note, '')), ''));
end;
$$;
revoke all on function public.admin_moderate_salary(uuid, text, text) from public, anon;
grant execute on function public.admin_moderate_salary(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------- admin: company requests

alter type public.request_status add value if not exists 'merged';
alter table public.company_requests add column resolved_company_id uuid references public.companies (id) on delete set null;
alter table public.company_requests add column resolved_at timestamptz;

create function public.slugify(t text) returns text
  language sql immutable set search_path = ''
as $$
  select left(btrim(regexp_replace(lower(t), '[^a-z0-9]+', '-', 'g'), '-'), 70);
$$;

create function public.admin_company_requests(p_status text default 'pending')
  returns table (id uuid, name text, industry text, state text, website text, status text, created_at timestamptz,
                 similar_companies jsonb)
  language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.require_admin();
  return query
  select r.id, r.name, r.industry, r.state, r.website, r.status::text, r.created_at,
         coalesce((
           select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug))
             from (select c.id, c.name, c.slug from public.companies c
                    where extensions.similarity(public.normalize_company_name(c.name), public.normalize_company_name(r.name)) >= 0.3
                    order by extensions.similarity(public.normalize_company_name(c.name), public.normalize_company_name(r.name)) desc
                    limit 3) c
         ), '[]'::jsonb)
    from public.company_requests r
   where (p_status = 'pending' and r.status = 'pending') or (p_status <> 'pending' and r.status <> 'pending')
   order by r.created_at
   limit 100;
end;
$$;
revoke all on function public.admin_company_requests(text) from public, anon;
grant execute on function public.admin_company_requests(text) to authenticated;

-- Approve: create an active company from the request (details can be corrected first). Returns the slug.
create function public.admin_approve_request(
  p_request_id uuid, p_name text, p_industry text, p_state text default null, p_city text default null,
  p_website text default null, p_size_range text default null, p_description text default null, p_note text default null
) returns text
  language plpgsql security definer set search_path = ''
as $$
declare
  admin uuid := public.require_admin();
  base text;
  candidate text;
  n int := 1;
  new_id uuid;
begin
  if not exists (select 1 from public.company_requests where id = p_request_id and status = 'pending') then
    raise exception 'request not pending' using errcode = 'P0002';
  end if;
  base := coalesce(nullif(public.slugify(p_name), ''), 'company');
  candidate := base;
  while exists (select 1 from public.companies where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  insert into public.companies (name, slug, industry, state, city, website, size_range, description, status)
  values (btrim(p_name), candidate, p_industry, nullif(p_state, ''), nullif(btrim(coalesce(p_city, '')), ''),
          nullif(btrim(coalesce(p_website, '')), ''), nullif(p_size_range, ''), nullif(btrim(coalesce(p_description, '')), ''), 'active')
  returning id into new_id;
  update public.company_requests set status = 'approved', resolved_company_id = new_id, resolved_at = now() where id = p_request_id;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values (admin, 'request_approve', 'company_request', p_request_id::text, nullif(btrim(coalesce(p_note, '')), ''));
  return candidate;
end;
$$;
revoke all on function public.admin_approve_request(uuid, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_approve_request(uuid, text, text, text, text, text, text, text, text) to authenticated;

create function public.admin_resolve_request(p_request_id uuid, p_action text, p_company_id uuid default null, p_note text default null)
  returns void
  language plpgsql security definer set search_path = ''
as $$
declare
  admin uuid := public.require_admin();
begin
  if p_action = 'merge' then
    if p_company_id is null or not exists (select 1 from public.companies where id = p_company_id) then
      raise exception 'choose a company to merge into' using errcode = 'P0002';
    end if;
    update public.company_requests set status = 'merged', resolved_company_id = p_company_id, resolved_at = now()
     where id = p_request_id and status = 'pending';
  elsif p_action = 'reject' then
    update public.company_requests set status = 'rejected', resolved_at = now()
     where id = p_request_id and status = 'pending';
  else
    raise exception 'unknown action';
  end if;
  if not found then
    raise exception 'request not pending' using errcode = 'P0002';
  end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values (admin, 'request_' || p_action, 'company_request', p_request_id::text, nullif(btrim(coalesce(p_note, '')), ''));
end;
$$;
revoke all on function public.admin_resolve_request(uuid, text, uuid, text) from public, anon;
grant execute on function public.admin_resolve_request(uuid, text, uuid, text) to authenticated;

-- ---------------------------------------------------------------- admin: companies

create function public.admin_companies(p_query text default '', p_id uuid default null)
  returns table (id uuid, name text, slug text, industry text, state text, city text, website text,
                 size_range text, description text, status text)
  language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.require_admin();
  return query
  select c.id, c.name, c.slug, c.industry, c.state, c.city, c.website, c.size_range, c.description, c.status::text
    from public.companies c
   where (p_id is not null and c.id = p_id)
      or (p_id is null and (coalesce(p_query, '') = '' or c.name ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'))
   order by c.name
   limit 50;
end;
$$;
revoke all on function public.admin_companies(text, uuid) from public, anon;
grant execute on function public.admin_companies(text, uuid) to authenticated;

create function public.admin_update_company(
  p_id uuid, p_name text, p_industry text, p_state text, p_city text, p_website text,
  p_size_range text, p_description text, p_status text, p_note text default null
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
         status = p_status::public.company_status
   where id = p_id;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values (admin, 'company_update', 'company', p_id::text, nullif(btrim(coalesce(p_note, '')), ''));
end;
$$;
revoke all on function public.admin_update_company(uuid, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_update_company(uuid, text, text, text, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------- admin: users

-- Pseudonym and account age, never email.
create function public.admin_users(p_query text default '', p_id uuid default null)
  returns table (id uuid, pseudonym text, user_type text, created_at timestamptz, is_admin boolean, is_banned boolean,
                 warnings int, posts int, reviews int, reports_against int)
  language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.require_admin();
  return query
  select p.id, p.pseudonym, p.user_type::text, p.created_at, p.is_admin, p.is_banned,
         (select count(*)::int from public.admin_actions a where a.action = 'user_warn' and a.target_id = p.id::text),
         (select count(*)::int from public.posts x where x.author_id = p.id),
         (select count(*)::int from public.reviews x where x.author_id = p.id),
         (select count(*)::int from public.reports r
           left join public.posts po on r.content_type = 'post' and po.id = r.content_id
           left join public.replies re on r.content_type = 'reply' and re.id = r.content_id
           left join public.reviews rv on r.content_type = 'review' and rv.id = r.content_id
           left join public.interview_reports iv on r.content_type = 'interview' and iv.id = r.content_id
          where coalesce(po.author_id, re.author_id, rv.author_id, iv.author_id) = p.id)
    from public.profiles p
   where (p_id is not null and p.id = p_id)
      or (p_id is null and (coalesce(p_query, '') = '' or p.pseudonym ilike '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'))
   order by p.created_at desc
   limit 50;
end;
$$;
revoke all on function public.admin_users(text, uuid) from public, anon;
grant execute on function public.admin_users(text, uuid) to authenticated;

create function public.admin_set_user(p_user_id uuid, p_action text, p_note text default null)
  returns void
  language plpgsql security definer set search_path = ''
as $$
declare
  admin uuid := public.require_admin();
  target record;
begin
  select * into target from public.profiles where id = p_user_id;
  if target.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if target.is_admin and p_action = 'ban' then
    raise exception 'admins can''t be banned here' using errcode = '42501';
  end if;
  p_note := nullif(btrim(coalesce(p_note, '')), '');

  if p_action = 'warn' then
    insert into public.notifications (user_id, type, message)
    values (p_user_id, 'moderation_warning',
            coalesce(p_note, 'A moderator has warned you about content that breaks our community guidelines.'));
  elsif p_action = 'ban' then
    update public.profiles set is_banned = true where id = p_user_id;
  elsif p_action = 'unban' then
    update public.profiles set is_banned = false where id = p_user_id;
  else
    raise exception 'unknown action';
  end if;

  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values (admin, 'user_' || p_action, 'user', p_user_id::text, p_note);
end;
$$;
revoke all on function public.admin_set_user(uuid, text, text) from public, anon;
grant execute on function public.admin_set_user(uuid, text, text) to authenticated;

-- Email is shown only to enforce a ban (e.g. block re-registration), and every look is logged.
create function public.admin_banned_user_email(p_user_id uuid)
  returns text
  language plpgsql security definer set search_path = ''
as $$
declare
  admin uuid := public.require_admin();
  result text;
begin
  if not exists (select 1 from public.profiles where id = p_user_id and is_banned) then
    raise exception 'email is only available for banned accounts' using errcode = '42501';
  end if;
  select email into result from auth.users where id = p_user_id;
  insert into public.admin_actions (admin_id, action, target_type, target_id, note)
  values (admin, 'user_email_viewed', 'user', p_user_id::text, 'Viewed email to enforce a ban');
  return result;
end;
$$;
revoke all on function public.admin_banned_user_email(uuid) from public, anon;
grant execute on function public.admin_banned_user_email(uuid) to authenticated;

create function public.admin_action_log()
  returns table (id uuid, admin_pseudonym text, action text, target_type text, target_id text, note text, created_at timestamptz)
  language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.require_admin();
  return query
  select a.id, case when a.admin_id is null then 'Automatic' else coalesce(p.pseudonym, 'Deleted admin') end,
         a.action, a.target_type, a.target_id, a.note, a.created_at
    from public.admin_actions a left join public.profiles p on p.id = a.admin_id
   order by a.created_at desc
   limit 200;
end;
$$;
revoke all on function public.admin_action_log() from public, anon;
grant execute on function public.admin_action_log() to authenticated;

create function public.admin_counts()
  returns table (open_reports int, pending_requests int, banned_users int)
  language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.require_admin();
  return query
  select (select count(distinct (content_type, content_key))::int from public.reports where status = 'open'),
         (select count(*)::int from public.company_requests where status = 'pending'),
         (select count(*)::int from public.profiles where is_banned);
end;
$$;
revoke all on function public.admin_counts() from public, anon;
grant execute on function public.admin_counts() to authenticated;
