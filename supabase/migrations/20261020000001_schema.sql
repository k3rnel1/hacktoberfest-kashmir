-- Hacktoberfest Kashmir: core schema.
-- Authentication identities live in auth.users (managed by Supabase Auth).
-- Passwords are never stored here.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  full_name text,
  mobile_number text,
  gmail text,
  github_username text,
  linkedin_url text,
  must_change_password boolean not null default false,
  profile_completed boolean generated always as (
    full_name is not null
    and mobile_number is not null
    and gmail is not null
    and github_username is not null
    and linkedin_url is not null
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_full_name_len check (full_name is null or char_length(btrim(full_name)) between 2 and 80),
  constraint profiles_mobile_format check (mobile_number is null or mobile_number ~ '^\+[1-9][0-9]{7,14}$'),
  constraint profiles_gmail_format check (gmail is null or gmail ~ '^[a-z0-9._%+-]+@gmail\.com$'),
  constraint profiles_github_format check (
    github_username is null
    or (github_username ~ '^[A-Za-z0-9]([A-Za-z0-9-]{0,37}[A-Za-z0-9])?$' and github_username !~ '--')
  ),
  constraint profiles_linkedin_format check (
    linkedin_url is null
    or linkedin_url ~ '^https://www\.linkedin\.com/in/[A-Za-z0-9_%-]{3,100}/?$'
  )
);

create unique index profiles_username_key on public.profiles (lower(username));

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  leader_id uuid not null references public.profiles (id) on delete restrict,
  -- SHA-256 hex of the invitation token. The token itself is derived server-side
  -- (HMAC of team id + invite_version) and is never stored.
  invite_token_hash text not null,
  invite_version integer not null default 1,
  invite_revoked boolean not null default false,
  invite_expires_at timestamptz,
  max_members integer not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint teams_name_len check (name = btrim(name) and char_length(name) between 3 and 40),
  constraint teams_description_len check (char_length(btrim(description)) between 10 and 300),
  constraint teams_max_members_range check (max_members between 2 and 20),
  constraint teams_invite_hash_unique unique (invite_token_hash)
);

create unique index teams_name_key on public.teams (lower(btrim(name)));
create index teams_leader_idx on public.teams (leader_id);
create index teams_created_idx on public.teams (created_at desc);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),

  -- A participant belongs to at most one team.
  constraint team_members_user_unique unique (user_id),
  constraint team_members_team_user_unique unique (team_id, user_id)
);

create index team_members_team_idx on public.team_members (team_id);
-- Exactly one leader per team.
create unique index team_members_one_leader on public.team_members (team_id) where role = 'leader';

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);

create table public.rate_limits (
  key text primary key,
  count integer not null,
  window_start timestamptz not null default now()
);

-- Triggers ------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger teams_set_updated_at before update on public.teams
  for each row execute function public.set_updated_at();

-- Creates the profile row in the same transaction as the auth user. A duplicate
-- username raises a unique violation, which aborts creation of the auth user too,
-- so identities without profiles cannot exist.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, lower(new.raw_user_meta_data ->> 'username'));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
