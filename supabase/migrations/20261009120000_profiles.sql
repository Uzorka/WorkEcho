-- Slice 1: accounts and anonymous identity.
--
-- One profile row per auth user. The browser may read and update ONLY its own
-- row, and only the user_type and state columns. Pseudonyms are assigned by
-- server code (service role); is_admin / is_banned are never writable by users.
-- Everyone else sees pseudonyms through the public_profiles view only.

create type public.user_type as enum ('current_employee', 'former_employee', 'job_seeker');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudonym text not null
    check (pseudonym ~ '^[A-Z][A-Za-z]{2,23}[0-9]{2}$'),
  -- Null until onboarding step 2.
  user_type public.user_type,
  -- 36 states + FCT. Optional.
  state text check (state in (
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
    'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
    'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
    'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
    'Yobe', 'Zamfara'
  )),
  is_admin boolean not null default false,
  is_banned boolean not null default false,
  -- How many times the pseudonym was regenerated during onboarding (max 3).
  pseudonym_regenerations smallint not null default 0
    check (pseudonym_regenerations between 0 and 3),
  -- Set when the user finishes onboarding. Requires a user type.
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  constraint onboarded_needs_user_type check (onboarded_at is null or user_type is not null)
);

-- Case-insensitive uniqueness: "QuietFalcon82" and "quietfalcon82" can't both exist.
create unique index profiles_pseudonym_lower_key on public.profiles (lower(pseudonym));

alter table public.profiles enable row level security;

-- Supabase grants everything on new public tables to anon/authenticated by
-- default. Take it all back, then grant only what is needed.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (user_type, state) on table public.profiles to authenticated;
-- No insert or delete for users: server code creates profiles, and account
-- deletion removes the auth user (which cascades here).

create policy "Users read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Public, safe view: pseudonym only. Runs with the view owner's rights so it
-- can read past RLS, but exposes no ids or account details.
create view public.public_profiles
  with (security_barrier = true)
  as select pseudonym from public.profiles;

revoke all on table public.public_profiles from anon, authenticated;
grant select on table public.public_profiles to anon, authenticated;

-- Finish onboarding for the calling user. Only works once a user type is set.
create function public.complete_onboarding()
  returns boolean
  language sql
  security definer
  set search_path = ''
as $$
  with done as (
    update public.profiles
       set onboarded_at = now()
     where id = auth.uid()
       and user_type is not null
       and onboarded_at is null
    returning 1
  )
  select exists (select 1 from done);
$$;

revoke all on function public.complete_onboarding() from public, anon;
grant execute on function public.complete_onboarding() to authenticated;
