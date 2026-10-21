-- Hacktoberfest Kashmir: transactional functions.
--
-- Mutation and admin functions are executable ONLY by service_role. They are called
-- from Next.js server actions, which take the acting user id from the verified
-- session, so a browser can never call them with another user's id.
-- Error conditions are raised as exceptions whose message is a stable code.

-- Rate limiting ---------------------------------------------------------------

create function public.rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as r (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else r.count + 1
        end,
        window_start = case
          when r.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else r.window_start
        end
  returning count into v_count;

  -- Opportunistic cleanup of stale keys.
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_count <= p_limit;
end;
$$;

-- Team lifecycle --------------------------------------------------------------

create function public.create_team(
  p_user_id uuid,
  p_team_id uuid,
  p_name text,
  p_description text,
  p_token_hash text,
  p_max_members integer,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_complete boolean;
  v_constraint text;
begin
  select profile_completed into v_complete from public.profiles where id = p_user_id;
  if v_complete is not true then
    raise exception 'PROFILE_INCOMPLETE';
  end if;

  if exists (select 1 from public.team_members where user_id = p_user_id) then
    raise exception 'ALREADY_IN_TEAM';
  end if;

  begin
    insert into public.teams (id, name, description, leader_id, invite_token_hash, max_members, invite_expires_at)
    values (p_team_id, btrim(p_name), btrim(p_description), p_user_id, p_token_hash, p_max_members, p_expires_at);

    insert into public.team_members (team_id, user_id, role)
    values (p_team_id, p_user_id, 'leader');
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'teams_name_key' then
        raise exception 'TEAM_NAME_TAKEN';
      elsif v_constraint = 'team_members_user_unique' then
        raise exception 'ALREADY_IN_TEAM';
      end if;
      raise;
    when check_violation then
      raise exception 'INVALID_INPUT';
  end;

  return p_team_id;
end;
$$;

create function public.join_team(p_user_id uuid, p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.teams%rowtype;
  v_complete boolean;
  v_count integer;
  v_current_team uuid;
begin
  -- The row lock serialises concurrent joins to the same team, so the capacity
  -- check below cannot be raced.
  select * into t from public.teams where invite_token_hash = p_token_hash for update;
  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  select team_id into v_current_team from public.team_members where user_id = p_user_id;
  if v_current_team = t.id then
    raise exception 'ALREADY_MEMBER';
  end if;

  if t.invite_revoked then
    raise exception 'INVITE_REVOKED';
  end if;
  if t.invite_expires_at is not null and t.invite_expires_at < now() then
    raise exception 'INVITE_EXPIRED';
  end if;

  select profile_completed into v_complete from public.profiles where id = p_user_id;
  if v_complete is not true then
    raise exception 'PROFILE_INCOMPLETE';
  end if;

  if v_current_team is not null then
    raise exception 'ALREADY_IN_TEAM';
  end if;

  select count(*) into v_count from public.team_members where team_id = t.id;
  if v_count >= t.max_members then
    raise exception 'TEAM_FULL';
  end if;

  begin
    insert into public.team_members (team_id, user_id, role) values (t.id, p_user_id, 'member');
  exception
    when unique_violation then
      raise exception 'ALREADY_IN_TEAM';
  end;

  return t.id;
end;
$$;

create function public.leave_team(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_role text;
begin
  select team_id into v_team from public.team_members where user_id = p_user_id;
  if v_team is null then
    raise exception 'NOT_IN_TEAM';
  end if;

  perform 1 from public.teams where id = v_team for update;

  select role into v_role from public.team_members where user_id = p_user_id;
  if v_role is null then
    raise exception 'NOT_IN_TEAM';
  end if;
  if v_role = 'leader' then
    raise exception 'LEADER_CANNOT_LEAVE';
  end if;

  delete from public.team_members where user_id = p_user_id;
end;
$$;

create function public.transfer_leadership(p_actor_id uuid, p_new_leader_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
begin
  select team_id into v_team from public.team_members where user_id = p_actor_id and role = 'leader';
  if v_team is null then
    raise exception 'NOT_LEADER';
  end if;

  perform 1 from public.teams where id = v_team for update;

  if p_new_leader_id = p_actor_id
     or not exists (select 1 from public.team_members where team_id = v_team and user_id = p_new_leader_id) then
    raise exception 'TARGET_NOT_MEMBER';
  end if;

  update public.team_members set role = 'member' where team_id = v_team and user_id = p_actor_id;
  update public.team_members set role = 'leader' where team_id = v_team and user_id = p_new_leader_id;
  update public.teams set leader_id = p_new_leader_id where id = v_team;
end;
$$;

create function public.dissolve_team(p_actor_id uuid, p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.teams where id = p_team_id and leader_id = p_actor_id for update;
  if not found then
    raise exception 'NOT_LEADER';
  end if;
  delete from public.teams where id = p_team_id;
end;
$$;

-- Invitations -----------------------------------------------------------------

-- Optimistic concurrency: the caller derives the next token from the current
-- version, so the update only applies if the version has not moved.
create function public.rotate_invite(
  p_actor_id uuid,
  p_team_id uuid,
  p_expected_version integer,
  p_new_hash text,
  p_expires_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.teams%rowtype;
begin
  select * into t from public.teams where id = p_team_id for update;
  if not found or t.leader_id <> p_actor_id then
    raise exception 'NOT_LEADER';
  end if;
  if t.invite_version <> p_expected_version then
    raise exception 'INVITE_VERSION_CONFLICT';
  end if;

  update public.teams
     set invite_version = p_expected_version + 1,
         invite_token_hash = p_new_hash,
         invite_revoked = false,
         invite_expires_at = p_expires_at
   where id = p_team_id;

  return p_expected_version + 1;
end;
$$;

create function public.revoke_invite(p_actor_id uuid, p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.teams set invite_revoked = true where id = p_team_id and leader_id = p_actor_id;
  if not found then
    raise exception 'NOT_LEADER';
  end if;
end;
$$;

-- Member-facing reads (callable by signed-in users, scoped by auth.uid()) -----

create function public.invite_preview(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t public.teams%rowtype;
  v_count integer;
  v_leader text;
  v_status text := 'ok';
  v_member boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into t from public.teams where invite_token_hash = p_token_hash;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  select count(*) into v_count from public.team_members where team_id = t.id;
  select full_name into v_leader from public.profiles where id = t.leader_id;
  v_member := exists (select 1 from public.team_members where team_id = t.id and user_id = auth.uid());

  if t.invite_revoked then
    v_status := 'revoked';
  elsif t.invite_expires_at is not null and t.invite_expires_at < now() then
    v_status := 'expired';
  elsif v_count >= t.max_members then
    v_status := 'full';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'team_id', t.id,
    'team_name', t.name,
    'description', t.description,
    'leader_name', v_leader,
    'member_count', v_count,
    'max_members', t.max_members,
    'already_member', v_member
  );
end;
$$;

-- Team page data for members only. Exposes no phone numbers or email addresses.
create function public.team_detail_for_member(p_team_id uuid)
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

-- Admin functions -------------------------------------------------------------

create function public.admin_log(
  p_admin_id uuid,
  p_action text,
  p_target_type text,
  p_target_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_logs (admin_user_id, action, target_type, target_id, metadata)
  values (p_admin_id, p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
$$;

create function public.admin_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with participants as (
    select p.* from public.profiles p
    where not exists (select 1 from public.admin_users a where a.user_id = p.id)
  )
  select jsonb_build_object(
    'total_users', (select count(*) from participants),
    'completed_profiles', (select count(*) from participants where profile_completed),
    'total_teams', (select count(*) from public.teams),
    'total_leaders', (select count(*) from public.team_members where role = 'leader'),
    'users_without_team', (
      select count(*) from participants pa
      where not exists (select 1 from public.team_members m where m.user_id = pa.id)
    ),
    'total_team_members', (select count(*) from public.team_members)
  );
$$;

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
           count(*) over () as total_count
    from public.profiles p
    left join public.team_members m on m.user_id = p.id
    left join public.teams t on t.id = m.team_id
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

create function public.admin_list_teams(
  p_q text default null,
  p_sort text default 'created_at',
  p_dir text default 'desc',
  p_limit integer default 25,
  p_offset integer default 0
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
    else 't.created_at'
  end;

  if p_q is not null and btrim(p_q) <> '' then
    v_pattern := '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query execute format($q$
    select t.id, t.name, t.description, t.leader_id, lp.full_name, lp.username,
           (select count(*) from public.team_members x where x.team_id = t.id),
           t.max_members, t.invite_revoked, t.created_at,
           count(*) over () as total_count
    from public.teams t
    join public.profiles lp on lp.id = t.leader_id
    where ($1::text is null or t.name ilike $1 or t.description ilike $1
           or lp.full_name ilike $1 or lp.username ilike $1 or t.id::text ilike $1)
    order by %s %s nulls last, t.id
    limit $2 offset $3
  $q$, v_order, v_dir)
  using v_pattern, least(coalesce(p_limit, 10000), 10000), greatest(coalesce(p_offset, 0), 0);
end;
$$;

create function public.admin_team_detail(p_team_id uuid)
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

create function public.admin_remove_member(p_admin_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_role text;
begin
  select team_id into v_team from public.team_members where user_id = p_user_id;
  if v_team is null then
    raise exception 'NOT_IN_TEAM';
  end if;

  perform 1 from public.teams where id = v_team for update;

  select role into v_role from public.team_members where user_id = p_user_id;
  if v_role = 'leader' then
    raise exception 'REMOVE_LEADER_BLOCKED';
  end if;

  delete from public.team_members where user_id = p_user_id;
  perform public.admin_log(p_admin_id, 'remove_member', 'user', p_user_id::text, jsonb_build_object('team_id', v_team));
end;
$$;

create function public.admin_revoke_invite(p_admin_id uuid, p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.teams set invite_revoked = true where id = p_team_id;
  if not found then
    raise exception 'TEAM_NOT_FOUND';
  end if;
  perform public.admin_log(p_admin_id, 'revoke_invite', 'team', p_team_id::text);
end;
$$;

create function public.admin_dissolve_team(p_admin_id uuid, p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_count integer;
begin
  select name into v_name from public.teams where id = p_team_id for update;
  if not found then
    raise exception 'TEAM_NOT_FOUND';
  end if;
  select count(*) into v_count from public.team_members where team_id = p_team_id;

  delete from public.teams where id = p_team_id;
  perform public.admin_log(
    p_admin_id, 'dissolve_team', 'team', p_team_id::text,
    jsonb_build_object('team_name', v_name, 'member_count', v_count)
  );
end;
$$;

-- Function privileges ---------------------------------------------------------

revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon, authenticated;

grant execute on function
  public.rate_limit_hit(text, integer, integer),
  public.create_team(uuid, uuid, text, text, text, integer, timestamptz),
  public.join_team(uuid, text),
  public.leave_team(uuid),
  public.transfer_leadership(uuid, uuid),
  public.dissolve_team(uuid, uuid),
  public.rotate_invite(uuid, uuid, integer, text, timestamptz),
  public.revoke_invite(uuid, uuid),
  public.admin_log(uuid, text, text, text, jsonb),
  public.admin_stats(),
  public.admin_list_users(text, text, text, text, text, text, integer, integer),
  public.admin_list_teams(text, text, text, integer, integer),
  public.admin_team_detail(uuid),
  public.admin_remove_member(uuid, uuid),
  public.admin_revoke_invite(uuid, uuid),
  public.admin_dissolve_team(uuid, uuid)
to service_role;

grant execute on function
  public.invite_preview(text),
  public.team_detail_for_member(uuid)
to authenticated;
