-- Hacktoberfest Kashmir: Row Level Security and table privileges.
--
-- Principle: browsers (anon/authenticated roles) get the narrowest possible read
-- access and NO direct write access except editing their own profile fields.
-- Everything else goes through service_role-only functions (see previous migration).

alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.admin_users enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.rate_limits enable row level security;

-- Start from nothing, then grant back precisely what is needed.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Returns the caller's team id. SECURITY DEFINER so it can be used inside policies
-- on team_members without recursing into that table's own policy.
create function public.my_team_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select team_id from public.team_members where user_id = auth.uid();
$$;

revoke all on function public.my_team_id() from public, anon, authenticated;
grant execute on function public.my_team_id() to authenticated;

-- profiles: a user can read and edit only their own row, and only the
-- participant-editable columns (username, completion flag, password flag are fixed).
grant select on public.profiles to authenticated;
grant update (full_name, mobile_number, gmail, github_username, linkedin_url)
  on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- teams: members can read their own team. invite_token_hash is intentionally not
-- granted, so it is never readable through the API.
grant select (
  id, name, description, leader_id, max_members, created_at, updated_at,
  invite_version, invite_revoked, invite_expires_at
) on public.teams to authenticated;

create policy teams_select_member on public.teams
  for select to authenticated
  using (id = public.my_team_id());

-- team_members: members can see the membership rows of their own team only.
grant select (id, team_id, user_id, role, joined_at) on public.team_members to authenticated;

create policy team_members_select_own_team on public.team_members
  for select to authenticated
  using (team_id = public.my_team_id());

-- admin_users, admin_audit_logs, rate_limits: RLS on, no policies, no grants.
-- Only service_role (which bypasses RLS) can touch them.
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
