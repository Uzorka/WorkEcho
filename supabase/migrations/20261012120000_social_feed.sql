-- Slice 4: social feed — posts, replies, likes and reply notifications.
--
-- Posts and replies publish instantly (they're conversations) and show the
-- author's pseudonym. Author ids never leave the database: users can't select
-- author_id/user_id columns, and public reads go through public_posts,
-- public_replies and feed_posts(), which expose the pseudonym plus
-- per-viewer flags (is_mine, liked_by_me) computed from auth.uid().

create type public.post_category as enum (
  'workplace_culture', 'salary_benefits', 'career_advice', 'management',
  'work_life_balance', 'interview_experiences', 'job_offers', 'general'
);
create type public.notification_type as enum ('reply_to_your_post');

-- ---------------------------------------------------------------- posts

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  category public.post_category not null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  status public.review_status not null default 'published',
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index posts_feed_latest_idx on public.posts (status, created_at desc, id desc);
create index posts_category_idx on public.posts (category, created_at desc);
create index posts_company_idx on public.posts (company_id, created_at desc);
create index posts_author_idx on public.posts (author_id);

-- Mark edits (shown as "edited"). Only real content changes count.
create function public.mark_edited() returns trigger
  language plpgsql set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger posts_mark_edited
  before update on public.posts
  for each row execute function public.mark_edited();

alter table public.posts enable row level security;
revoke all on table public.posts from anon, authenticated;
grant select (id, company_id, category, body, status, created_at, edited_at) on table public.posts to authenticated;
grant insert (company_id, category, body) on table public.posts to authenticated;
grant update (category, body) on table public.posts to authenticated;
grant delete on table public.posts to authenticated;

create policy "Authors read their own posts"
  on public.posts for select to authenticated
  using (author_id = (select auth.uid()));

create policy "Signed-in users post"
  on public.posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select public.can_contribute())
    and (company_id is null or exists (select 1 from public.companies c where c.id = company_id and c.status = 'active'))
  );

create policy "Authors edit their own posts unless removed"
  on public.posts for update to authenticated
  using (author_id = (select auth.uid()) and status <> 'removed')
  with check (author_id = (select auth.uid()));

create policy "Authors delete their own posts"
  on public.posts for delete to authenticated
  using (author_id = (select auth.uid()));

-- True when the post is publicly visible.
create function public.post_is_visible(p_post_id uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.posts where id = p_post_id and status = 'published');
$$;
revoke all on function public.post_is_visible(uuid) from public, anon;
grant execute on function public.post_is_visible(uuid) to authenticated;

-- ---------------------------------------------------------------- replies (one level only)

create table public.replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  status public.review_status not null default 'published',
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index replies_post_idx on public.replies (post_id, created_at);
create index replies_author_idx on public.replies (author_id);

create trigger replies_mark_edited
  before update on public.replies
  for each row execute function public.mark_edited();

alter table public.replies enable row level security;
revoke all on table public.replies from anon, authenticated;
grant select (id, post_id, body, status, created_at, edited_at) on table public.replies to authenticated;
grant insert (post_id, body) on table public.replies to authenticated;
grant update (body) on table public.replies to authenticated;
grant delete on table public.replies to authenticated;

create policy "Authors read their own replies"
  on public.replies for select to authenticated
  using (author_id = (select auth.uid()));

create policy "Signed-in users reply to visible posts"
  on public.replies for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select public.can_contribute())
    and public.post_is_visible(post_id)
  );

create policy "Authors edit their own replies unless removed"
  on public.replies for update to authenticated
  using (author_id = (select auth.uid()) and status <> 'removed')
  with check (author_id = (select auth.uid()));

create policy "Authors delete their own replies"
  on public.replies for delete to authenticated
  using (author_id = (select auth.uid()));

-- ---------------------------------------------------------------- likes

create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_likes_user_idx on public.post_likes (user_id);

alter table public.post_likes enable row level security;
revoke all on table public.post_likes from anon, authenticated;
grant select (post_id) on table public.post_likes to authenticated;
grant insert (post_id) on table public.post_likes to authenticated;
grant delete on table public.post_likes to authenticated;

create policy "Users read their own likes"
  on public.post_likes for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users like visible posts"
  on public.post_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.can_contribute())
    and public.post_is_visible(post_id)
  );

create policy "Users remove their own likes"
  on public.post_likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- notifications

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  post_id uuid not null references public.posts (id) on delete cascade,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;
-- Own rows only, never user_id. Only is_read can change. Rows are created by the trigger below.
grant select (id, type, post_id, is_read, created_at) on table public.notifications to authenticated;
grant update (is_read) on table public.notifications to authenticated;

create policy "Users read their own notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users mark their own notifications read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- New reply -> notify the post's author (not the replier, and not if they
-- reply to their own post). The notification stores no replier id.
create function public.notify_post_author() returns trigger
  language plpgsql security definer set search_path = ''
as $$
declare
  owner uuid;
begin
  select author_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner is distinct from new.author_id then
    insert into public.notifications (user_id, type, post_id)
    values (owner, 'reply_to_your_post', new.post_id);
  end if;
  return new;
end;
$$;

create trigger replies_notify_post_author
  after insert on public.replies
  for each row execute function public.notify_post_author();

-- ---------------------------------------------------------------- public reads

create view public.public_posts
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
  exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid()) as liked_by_me
from public.posts p
left join public.profiles pr on pr.id = p.author_id
left join public.companies c on c.id = p.company_id and c.status = 'active'
where p.status = 'published';

revoke all on table public.public_posts from anon, authenticated;
grant select on table public.public_posts to anon, authenticated;

create view public.public_replies
  with (security_barrier = true)
as
select
  r.id,
  r.post_id,
  r.body,
  r.created_at,
  r.edited_at,
  coalesce(pr.pseudonym, 'Deleted user') as author_pseudonym,
  coalesce(r.author_id = auth.uid(), false) as is_mine
from public.replies r
join public.posts p on p.id = r.post_id and p.status = 'published'
left join public.profiles pr on pr.id = r.author_id
where r.status = 'published';

revoke all on table public.public_replies from anon, authenticated;
grant select on table public.public_replies to anon, authenticated;

-- A page of the feed with keyset ("cursor") pagination.
--   latest: newest first; cursor = (created_at, id) of the last post seen.
--   top:    last 7 days, most liked first; cursor = (like_count, created_at, id).
-- Runs as the caller (reads the public view only).
create function public.feed_posts(
  p_sort text default 'latest',
  p_category public.post_category default null,
  p_company_id uuid default null,
  p_after_created timestamptz default null,
  p_after_id uuid default null,
  p_after_likes int default null,
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
              or (pp.like_count, pp.created_at, pp.id) < (p_after_likes, p_after_created, p_after_id))
       else
         p_after_id is null or (pp.created_at, pp.id) < (p_after_created, p_after_id)
       end
     )
   order by
     case when p_sort = 'top' then pp.like_count end desc nulls last,
     pp.created_at desc,
     pp.id desc
   limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;
grant execute on function public.feed_posts(text, public.post_category, uuid, timestamptz, uuid, int, int) to anon, authenticated;
