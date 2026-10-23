-- Hacktoberfest Kashmir: finalist teams and awards.
--
-- Adds a finalist flag plus an optional award (for example "Winner" or "Best Use
-- of AI") to every team, an audited admin RPC to change them, and a public read
-- function that returns only safe fields (team name, description, award, member
-- names). Apply once, after the team selection status migration.

-- Columns -----------------------------------------------------------------------

alter table public.teams
  add column is_finalist boolean not null default false,
  add column award text,
  add column award_rank integer,
  add column finalist_updated_at timestamptz,
  add constraint teams_award_len check (award is null or char_length(btrim(award)) between 2 and 60),
  add constraint teams_award_rank_range check (award_rank is null or award_rank between 1 and 99),
  -- Awards belong to finalists only, and a rank only makes sense with an award.
  add constraint teams_award_requires_finalist check (
    (is_finalist or (award is null and award_rank is null))
    and (award_rank is null or award is not null)
  );

create index teams_finalist_idx on public.teams (is_finalist) where is_finalist;

-- Browser roles still cannot read or write these columns (column-level grants in
-- the RLS migration). They are exposed only through the functions below.

-- Admin: mark a team as finalist and set its award ------------------------------

create function public.admin_set_team_finalist(
  p_admin_id uuid,
  p_team_id uuid,
  p_finalist boolean,
  p_award text default null,
  p_rank integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_award text := nullif(btrim(p_award), '');
  v_rank integer := p_rank;
begin
  if p_finalist is null then
    raise exception 'INVALID_INPUT';
  end if;

  select selection_status into v_status from public.teams where id = p_team_id for update;
  if not found then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  if not p_finalist then
    v_award := null;
    v_rank := null;
  else
    if v_status <> 'selected' then
      raise exception 'NOT_SELECTED';
    end if;
    if v_award is not null and char_length(v_award) not between 2 and 60 then
      raise exception 'INVALID_INPUT';
    end if;
    if v_rank is not null and (v_rank not between 1 and 99 or v_award is null) then
      raise exception 'INVALID_INPUT';
    end if;
  end if;

  update public.teams
  set is_finalist = p_finalist,
      award = v_award,
      award_rank = v_rank,
      finalist_updated_at = now()
  where id = p_team_id;

  perform public.admin_log(
    p_admin_id, 'set_team_finalist', 'team', p_team_id::text,
    jsonb_build_object('finalist', p_finalist, 'award', v_award, 'rank', v_rank)
  );
end;
$$;

-- Public finalists page data ------------------------------------------------------
-- Returns team name, description, award and member names only: no ids, contact
-- details or links. Called from the server with the service-role client.

create function public.public_finalists()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'name', t.name,
      'description', t.description,
      'award', t.award,
      'award_rank', t.award_rank,
      'members', coalesce((
        select jsonb_agg(coalesce(p.full_name, p.username)
                         order by (m.role = 'leader') desc, m.joined_at)
        from public.team_members m
        join public.profiles p on p.id = m.user_id
        where m.team_id = t.id
      ), '[]'::jsonb)
    )
    order by (t.award is null), t.award_rank nulls last, lower(t.name)
  ), '[]'::jsonb)
  from public.teams t
  where t.is_finalist;
$$;

-- Admin team detail: add finalist fields ------------------------------------------

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
    'is_finalist', t.is_finalist,
    'award', t.award,
    'award_rank', t.award_rank,
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

-- Admin team list: add finalist columns (return type changes, so drop + recreate) --

drop function public.admin_list_teams(text, text, text, integer, integer, text);

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
  is_finalist boolean,
  award text,
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
           t.is_finalist, t.award,
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

-- Function privileges (dropped functions lose their grants) -----------------------

revoke all on function
  public.admin_set_team_finalist(uuid, uuid, boolean, text, integer),
  public.public_finalists(),
  public.admin_list_teams(text, text, text, integer, integer, text)
from public, anon, authenticated;

grant execute on function
  public.admin_set_team_finalist(uuid, uuid, boolean, text, integer),
  public.public_finalists(),
  public.admin_list_teams(text, text, text, integer, integer, text)
to service_role;
