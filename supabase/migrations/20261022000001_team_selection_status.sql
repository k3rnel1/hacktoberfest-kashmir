-- Hacktoberfest Kashmir: team selection phase.
--
-- Adds a selection status to every team, an admin-only RPC to change it (audited),
-- and extends the existing read functions so the participant dashboard, the admin
-- panel and the participants CSV export can show it.
--
-- Safe to run on a populated database: the new column has a default, so every
-- existing team becomes 'in_process'. Re-running is not supported (like the other
-- migrations); apply it once.

-- Columns -----------------------------------------------------------------------

alter table public.teams
  add column selection_status text not null default 'in_process',
  add column selection_status_updated_at timestamptz,
  add column selection_status_updated_by uuid references auth.users (id) on delete set null,
  add constraint teams_selection_status_check
    check (selection_status in ('in_process', 'selected', 'on_hold', 'rejected'));

create index teams_selection_status_idx on public.teams (selection_status);

-- No grants/policies change: the browser roles can only read the columns listed in
-- the RLS migration, so these columns are not readable directly. Participants get
-- the status through team_detail_for_member(); only service_role can write it.

-- Admin: change a team's selection status ----------------------------------------

create function public.admin_set_team_status(
  p_admin_id uuid,
  p_team_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if p_status is null or p_status not in ('in_process', 'selected', 'on_hold', 'rejected') then
    raise exception 'INVALID_STATUS';
  end if;

  select selection_status into v_old from public.teams where id = p_team_id for update;
  if not found then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  -- Re-saving the current status changes nothing and is not audited.
  if v_old = p_status then
    return;
  end if;

  update public.teams
  set selection_status = p_status,
      selection_status_updated_at = now(),
      selection_status_updated_by = p_admin_id
  where id = p_team_id;

  perform public.admin_log(
    p_admin_id, 'set_team_status', 'team', p_team_id::text,
    jsonb_build_object('from', v_old, 'to', p_status)
  );
end;
$$;

-- Participant view: add the status (no admin identity is exposed) ----------------

create or replace function public.team_detail_for_member(p_team_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null
     or not exists (select 1 from public.team_members where team_id = p_team_id and user_id = auth.uid()) then
    return null;
  end if;

  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'description', t.description,
    'leader_id', t.leader_id,
    'max_members', t.max_members,
    'created_at', t.created_at,
    'selection_status', t.selection_status,
    'selection_status_updated_at', t.selection_status_updated_at,
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', m.user_id,
          'role', m.role,
          'joined_at', m.joined_at,
          'full_name', p.full_name,
          'github_username', p.github_username,
          'linkedin_url', p.linkedin_url
        )
        order by (m.role = 'leader') desc, m.joined_at
      )
      from public.team_members m
      join public.profiles p on p.id = m.user_id
      where m.team_id = t.id
    ), '[]'::jsonb)
  )
  into result
  from public.teams t
  where t.id = p_team_id;

  return result;
end;
$$;

-- Admin team detail: add status + who/when ---------------------------------------

create or replace function public.admin_team_detail(p_team_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'description', t.description,
    'leader_id', t.leader_id,
    'max_members', t.max_members,
    'invite_revoked', t.invite_revoked,
    'invite_expires_at', t.invite_expires_at,
    'created_at', t.created_at,
    'selection_status', t.selection_status,
    'selection_status_updated_at', t.selection_status_updated_at,
    'selection_status_updated_by', (
      select up.username from public.profiles up where up.id = t.selection_status_updated_by
    ),
    'members', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', m.user_id,
          'role', m.role,
          'joined_at', m.joined_at,
          'username', p.username,
          'full_name', p.full_name,
          'mobile_number', p.mobile_number,
          'gmail', p.gmail,
          'github_username', p.github_username,
          'linkedin_url', p.linkedin_url
        )
        order by (m.role = 'leader') desc, m.joined_at
      )
      from public.team_members m
      join public.profiles p on p.id = m.user_id
      where m.team_id = t.id
    ), '[]'::jsonb)
  )
  from public.teams t
  where t.id = p_team_id;
$$;

-- Admin team list: add status columns and a status filter -------------------------
-- The return type changes, so the function must be dropped and recreated.

drop function public.admin_list_teams(text, text, text, integer, integer);

create function public.admin_list_teams(
  p_q text default null,
  p_sort text default 'created_at',
  p_dir text default 'desc',
  p_limit integer default 25,
  p_offset integer default 0,
  p_status text default 'all'
)
returns table (
  id uuid,
  name text,
  description text,
  leader_id uuid,
  leader_name text,
  leader_username text,
  member_count bigint,
  max_members integer,
  invite_revoked boolean,
  created_at timestamptz,
  selection_status text,
  selection_status_updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order text;
  v_dir text := case when lower(p_dir) = 'asc' then 'asc' else 'desc' end;
  v_pattern text;
begin
  v_order := case p_sort
    when 'name' then 'lower(t.name)'
    when 'leader_name' then 'lower(lp.full_name)'
    when 'member_count' then '(select count(*) from public.team_members x where x.team_id = t.id)'
    when 'selection_status' then 't.selection_status'
    else 't.created_at'
  end;

  if p_q is not null and btrim(p_q) <> '' then
    v_pattern := '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query execute format($q$
    select t.id, t.name, t.description, t.leader_id, lp.full_name, lp.username,
           (select count(*) from public.team_members x where x.team_id = t.id),
           t.max_members, t.invite_revoked, t.created_at,
           t.selection_status, t.selection_status_updated_at,
           count(*) over () as total_count
    from public.teams t
    join public.profiles lp on lp.id = t.leader_id
    where ($1::text is null or t.name ilike $1 or t.description ilike $1
           or lp.full_name ilike $1 or lp.username ilike $1 or t.id::text ilike $1)
      and ($4 = 'all' or t.selection_status = $4)
    order by %s %s nulls last, t.id
    limit $2 offset $3
  $q$, v_order, v_dir)
  using v_pattern, least(coalesce(p_limit, 10000), 10000), greatest(coalesce(p_offset, 0), 0),
        coalesce(p_status, 'all');
end;
$$;

-- Admin participant list (also feeds the CSV export): add status + metadata -------

drop function public.admin_list_users(text, text, text, text, text, text, integer, integer);

create function public.admin_list_users(
  p_q text default null,
  p_membership text default 'all',
  p_role text default 'all',
  p_completed text default 'all',
  p_sort text default 'created_at',
  p_dir text default 'desc',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  username text,
  full_name text,
  mobile_number text,
  gmail text,
  github_username text,
  linkedin_url text,
  profile_completed boolean,
  created_at timestamptz,
  team_id uuid,
  team_name text,
  team_role text,
  selection_status text,
  selection_status_updated_at timestamptz,
  selection_status_updated_by text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_order text;
  v_dir text := case when lower(p_dir) = 'asc' then 'asc' else 'desc' end;
  v_pattern text;
begin
  v_order := case p_sort
    when 'username' then 'p.username'
    when 'full_name' then 'lower(p.full_name)'
    when 'gmail' then 'p.gmail'
    when 'team_name' then 'lower(t.name)'
    when 'team_role' then 'm.role'
    when 'profile_completed' then 'p.profile_completed'
    else 'p.created_at'
  end;

  if p_q is not null and btrim(p_q) <> '' then
    v_pattern := '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query execute format($q$
    select p.id, p.username, p.full_name, p.mobile_number, p.gmail, p.github_username,
           p.linkedin_url, p.profile_completed, p.created_at,
           t.id, t.name, m.role,
           t.selection_status, t.selection_status_updated_at, up.username,
           count(*) over () as total_count
    from public.profiles p
    left join public.team_members m on m.user_id = p.id
    left join public.teams t on t.id = m.team_id
    left join public.profiles up on up.id = t.selection_status_updated_by
    where not exists (select 1 from public.admin_users a where a.user_id = p.id)
      and ($1::text is null or p.username ilike $1 or p.full_name ilike $1 or p.gmail ilike $1
           or p.github_username ilike $1 or t.name ilike $1)
      and ($2 = 'all' or ($2 = 'in_team' and m.user_id is not null) or ($2 = 'no_team' and m.user_id is null))
      and ($3 = 'all' or m.role = $3)
      and ($4 = 'all' or ($4 = 'complete' and p.profile_completed) or ($4 = 'incomplete' and not p.profile_completed))
    order by %s %s nulls last, p.id
    limit $5 offset $6
  $q$, v_order, v_dir)
  using v_pattern, p_membership, p_role, p_completed, least(coalesce(p_limit, 10000), 10000), greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Function privileges (dropped functions lose their grants) -----------------------

revoke all on function
  public.admin_set_team_status(uuid, uuid, text),
  public.admin_list_teams(text, text, text, integer, integer, text),
  public.admin_list_users(text, text, text, text, text, text, integer, integer)
from public, anon, authenticated;

grant execute on function
  public.admin_set_team_status(uuid, uuid, text),
  public.admin_list_teams(text, text, text, integer, integer, text),
  public.admin_list_users(text, text, text, text, text, text, integer, integer)
to service_role;
