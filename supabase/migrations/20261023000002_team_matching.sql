-- Hacktoberfest Kashmir: team matching.
--
-- Participants can browse teams and request to join, register as "looking for a
-- team", and team leaders can invite those participants. All writes go through
-- service_role-only functions (called from server actions after the session is
-- verified); reads go through SECURITY DEFINER functions that use auth.uid() and
-- return only discovery-safe fields. The new tables have RLS on and no grants for
-- anon/authenticated, so nothing can be read or edited directly from a browser.
--
-- Existing rules are reused, not changed: one team per participant (unique
-- team_members.user_id), the leader counts toward teams.max_members, and the team
-- row lock used by join_team also serialises acceptance here. Selection status is
-- not touched: accepting members never selects or approves a team.

-- Tables ------------------------------------------------------------------------

create table public.looking_for_team (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  skills text[] not null default '{}',
  interests text[] not null default '{}',
  intro text not null default '',
  preferred_role text,
  portfolio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint lft_skills_count check (cardinality(skills) <= 10),
  constraint lft_interests_count check (cardinality(interests) <= 10),
  constraint lft_intro_len check (char_length(intro) <= 300),
  constraint lft_role_len check (preferred_role is null or char_length(preferred_role) between 2 and 40),
  constraint lft_portfolio_format check (
    portfolio_url is null or portfolio_url ~ '^https://[^[:space:]]{4,200}$'
  )
);

create trigger looking_for_team_set_updated_at before update on public.looking_for_team
  for each row execute function public.set_updated_at();

-- One table for both directions: a participant asking to join a team ('request') and
-- a team leader inviting a participant ('invitation').
create table public.team_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  direction text not null check (direction in ('request', 'invitation')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,

  constraint team_requests_responded check (status = 'pending' or responded_at is not null)
);

-- At most one open request/invitation between a given team and participant.
create unique index team_requests_one_pending on public.team_requests (team_id, user_id)
  where status = 'pending';
create index team_requests_user_idx on public.team_requests (user_id, status);
create index team_requests_team_idx on public.team_requests (team_id, status);

alter table public.looking_for_team enable row level security;
alter table public.team_requests enable row level security;

revoke all on public.looking_for_team, public.team_requests from anon, authenticated;
grant all on public.looking_for_team, public.team_requests to service_role;

-- Internal helper: the single place that decides whether a team can take a member.
-- (Capacity only, matching join_team. Selection status is deliberately not checked.)

create function public.team_accepts_members(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.team_members m where m.team_id = t.id) < t.max_members
  from public.teams t
  where t.id = p_team_id;
$$;

-- Keep listings and open requests consistent whenever someone joins a team, by any
-- route (create team, invite link, accepted request or invitation, admin tools).

create function public.on_member_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.looking_for_team where user_id = new.user_id;
  update public.team_requests
  set status = 'cancelled', responded_at = now()
  where user_id = new.user_id and status = 'pending';
  return new;
end;
$$;

create trigger team_members_after_insert after insert on public.team_members
  for each row execute function public.on_member_added();

-- Writes (service_role only) ------------------------------------------------------

create function public.upsert_looking_listing(
  p_user_id uuid,
  p_skills text[],
  p_interests text[],
  p_intro text,
  p_role text,
  p_portfolio text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_skills text[];
  v_interests text[];
  v_intro text := btrim(coalesce(p_intro, ''));
  v_role text := nullif(btrim(coalesce(p_role, '')), '');
  v_portfolio text := nullif(btrim(coalesce(p_portfolio, '')), '');
begin
  if (select profile_completed from public.profiles where id = p_user_id) is not true then
    raise exception 'PROFILE_INCOMPLETE';
  end if;
  if exists (select 1 from public.team_members where user_id = p_user_id) then
    raise exception 'ALREADY_IN_TEAM';
  end if;

  -- Trim, drop blanks, de-duplicate case-insensitively, keep first spelling.
  select coalesce(array_agg(s order by o), '{}') into v_skills from (
    select distinct on (lower(btrim(x))) btrim(x) as s, o
    from unnest(coalesce(p_skills, '{}')) with ordinality as u(x, o)
    where btrim(x) <> ''
    order by lower(btrim(x)), o
  ) d;
  select coalesce(array_agg(s order by o), '{}') into v_interests from (
    select distinct on (lower(btrim(x))) btrim(x) as s, o
    from unnest(coalesce(p_interests, '{}')) with ordinality as u(x, o)
    where btrim(x) <> ''
    order by lower(btrim(x)), o
  ) d;

  if cardinality(v_skills) > 10 or cardinality(v_interests) > 10
     or exists (select 1 from unnest(v_skills || v_interests) e where char_length(e) not between 1 and 30) then
    raise exception 'INVALID_INPUT';
  end if;

  begin
    insert into public.looking_for_team (user_id, skills, interests, intro, preferred_role, portfolio_url)
    values (p_user_id, v_skills, v_interests, v_intro, v_role, v_portfolio)
    on conflict (user_id) do update
      set skills = excluded.skills,
          interests = excluded.interests,
          intro = excluded.intro,
          preferred_role = excluded.preferred_role,
          portfolio_url = excluded.portfolio_url;
  exception when check_violation then
    raise exception 'INVALID_INPUT';
  end;
end;
$$;

create function public.withdraw_looking_listing(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.looking_for_team where user_id = p_user_id;
$$;

create function public.request_to_join(p_user_id uuid, p_team_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_team uuid;
  v_id uuid;
begin
  -- Same lock as join_team: capacity checks for one team are serialised.
  perform 1 from public.teams where id = p_team_id for update;
  if not found then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  if (select profile_completed from public.profiles where id = p_user_id) is not true then
    raise exception 'PROFILE_INCOMPLETE';
  end if;

  select team_id into v_current_team from public.team_members where user_id = p_user_id;
  if v_current_team = p_team_id then
    raise exception 'ALREADY_MEMBER';
  elsif v_current_team is not null then
    raise exception 'ALREADY_IN_TEAM';
  end if;

  if not public.team_accepts_members(p_team_id) then
    raise exception 'TEAM_FULL';
  end if;

  begin
    insert into public.team_requests (team_id, user_id, direction)
    values (p_team_id, p_user_id, 'request')
    returning id into v_id;
  exception when unique_violation then
    raise exception 'DUPLICATE_REQUEST';
  end;

  return v_id;
end;
$$;

-- The invitation is always sent for the caller's own team (derived here, never
-- passed in), so a leader cannot act for another team.
create function public.send_team_invitation(p_leader_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_id uuid;
begin
  select id into v_team from public.teams where leader_id = p_leader_id for update;
  if v_team is null then
    raise exception 'NOT_LEADER';
  end if;
  if p_user_id = p_leader_id then
    raise exception 'INVALID_INPUT';
  end if;

  if exists (select 1 from public.team_members where user_id = p_user_id) then
    raise exception 'TARGET_UNAVAILABLE';
  end if;
  if not exists (select 1 from public.looking_for_team where user_id = p_user_id) then
    raise exception 'TARGET_NOT_LOOKING';
  end if;

  if not public.team_accepts_members(v_team) then
    raise exception 'TEAM_FULL';
  end if;

  begin
    insert into public.team_requests (team_id, user_id, direction)
    values (v_team, p_user_id, 'invitation')
    returning id into v_id;
  exception when unique_violation then
    raise exception 'DUPLICATE_REQUEST';
  end;

  return v_id;
end;
$$;

-- Cancel: the participant cancels their own request; the leader cancels an
-- invitation their team sent.
create function public.cancel_team_request(p_actor_id uuid, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.team_requests%rowtype;
  v_leader uuid;
begin
  select * into r from public.team_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  select leader_id into v_leader from public.teams where id = r.team_id;

  if not ((r.direction = 'request' and r.user_id = p_actor_id)
          or (r.direction = 'invitation' and v_leader = p_actor_id)) then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if r.status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING';
  end if;

  update public.team_requests set status = 'cancelled', responded_at = now() where id = r.id;
end;
$$;

-- Accept / reject: the team leader answers a request; the invited participant
-- answers an invitation. Acceptance rechecks everything under the team row lock.
create function public.respond_to_team_request(p_actor_id uuid, p_request_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  r public.team_requests%rowtype;
  v_leader uuid;
begin
  select team_id into v_team from public.team_requests where id = p_request_id;
  if v_team is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  -- Lock order is always team, then request, to avoid deadlocks.
  select leader_id into v_leader from public.teams where id = v_team for update;
  select * into r from public.team_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  if not ((r.direction = 'request' and v_leader = p_actor_id)
          or (r.direction = 'invitation' and r.user_id = p_actor_id)) then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if r.status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING';
  end if;

  if not p_accept then
    update public.team_requests set status = 'rejected', responded_at = now() where id = r.id;
    return r.team_id;
  end if;

  if (select profile_completed from public.profiles where id = r.user_id) is not true then
    raise exception 'PROFILE_INCOMPLETE';
  end if;
  if exists (select 1 from public.team_members where user_id = r.user_id) then
    raise exception 'ALREADY_IN_TEAM';
  end if;
  if not public.team_accepts_members(r.team_id) then
    raise exception 'TEAM_FULL';
  end if;

  -- Mark accepted first: the member-added trigger cancels the user's other open
  -- requests and invitations, and must not touch this one.
  update public.team_requests set status = 'accepted', responded_at = now() where id = r.id;
  begin
    insert into public.team_members (team_id, user_id, role) values (r.team_id, r.user_id, 'member');
  exception when unique_violation then
    raise exception 'ALREADY_IN_TEAM';
  end;

  return r.team_id;
end;
$$;

-- Reads (authenticated, discovery-safe fields only) -------------------------------

create function public.browse_teams(
  p_q text default null,
  p_only_open boolean default false,
  p_limit integer default 60,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pattern text;
  result jsonb;
begin
  if v_uid is null
     or (select profile_completed from public.profiles where id = v_uid) is not true then
    return jsonb_build_object('total', 0, 'teams', '[]'::jsonb);
  end if;

  if p_q is not null and btrim(p_q) <> '' then
    v_pattern := '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with base as (
    select t.id, t.name, t.description, t.max_members, t.created_at, t.leader_id,
           coalesce(lp.full_name, lp.username) as leader_name,
           (select count(*) from public.team_members x where x.team_id = t.id) as member_count
    from public.teams t
    join public.profiles lp on lp.id = t.leader_id
    where v_pattern is null or t.name ilike v_pattern
  ),
  filtered as (
    select * from base where not coalesce(p_only_open, false) or member_count < max_members
  ),
  page as (
    select * from filtered
    order by (member_count >= max_members), lower(name), id
    limit least(greatest(coalesce(p_limit, 60), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'teams', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'name', f.name,
          'description', f.description,
          'leader_name', f.leader_name,
          'member_count', f.member_count,
          'max_members', f.max_members,
          'open_slots', greatest(f.max_members - f.member_count, 0),
          'is_open', f.member_count < f.max_members,
          'is_my_team', exists (
            select 1 from public.team_members me where me.team_id = f.id and me.user_id = v_uid
          ),
          'members', coalesce((
            select jsonb_agg(coalesce(p.full_name, p.username)
                             order by (m.role = 'leader') desc, m.joined_at)
            from public.team_members m
            join public.profiles p on p.id = m.user_id
            where m.team_id = f.id
          ), '[]'::jsonb),
          'my_request', (
            select jsonb_build_object('id', r.id, 'direction', r.direction, 'status', r.status)
            from public.team_requests r
            where r.team_id = f.id and r.user_id = v_uid
            order by r.created_at desc
            limit 1
          )
        )
        order by (f.member_count >= f.max_members), lower(f.name), f.id
      )
      from page f
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create function public.browse_seekers(
  p_q text default null,
  p_skill text default null,
  p_limit integer default 60,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pattern text;
  v_skill text;
  v_my_team uuid;
  result jsonb;
begin
  if v_uid is null
     or (select profile_completed from public.profiles where id = v_uid) is not true then
    return jsonb_build_object('total', 0, 'seekers', '[]'::jsonb);
  end if;

  select id into v_my_team from public.teams where leader_id = v_uid;

  if p_q is not null and btrim(p_q) <> '' then
    v_pattern := '%' || replace(replace(replace(btrim(p_q), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  if p_skill is not null and btrim(p_skill) <> '' then
    v_skill := '%' || replace(replace(replace(btrim(p_skill), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with base as (
    select l.*, p.full_name, p.username, p.github_username
    from public.looking_for_team l
    join public.profiles p on p.id = l.user_id
    where not exists (select 1 from public.team_members m where m.user_id = l.user_id)
      and (v_pattern is null
           or coalesce(p.full_name, p.username) ilike v_pattern
           or l.intro ilike v_pattern
           or l.preferred_role ilike v_pattern
           or exists (select 1 from unnest(l.skills || l.interests) s where s ilike v_pattern))
      and (v_skill is null
           or exists (select 1 from unnest(l.skills) s where s ilike v_skill))
  ),
  page as (
    select * from base
    order by updated_at desc, user_id
    limit least(greatest(coalesce(p_limit, 60), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'seekers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', b.user_id,
          'name', coalesce(b.full_name, b.username),
          'skills', to_jsonb(b.skills),
          'interests', to_jsonb(b.interests),
          'intro', b.intro,
          'preferred_role', b.preferred_role,
          'portfolio_url', b.portfolio_url,
          'github_username', b.github_username,
          'is_me', b.user_id = v_uid,
          'invited', exists (
            select 1 from public.team_requests r
            where r.team_id = v_my_team and r.user_id = b.user_id and r.status = 'pending'
          )
        )
        order by b.updated_at desc, b.user_id
      )
      from page b
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Everything the signed-in participant needs for the Looking / Requests tabs.
create function public.my_matching_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_team record;
  v_has_team boolean := false;
  v_is_leader boolean := false;
  result jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  select t.id, t.name, t.leader_id, t.max_members,
         (select count(*) from public.team_members x where x.team_id = t.id) as member_count
  into v_team
  from public.team_members m
  join public.teams t on t.id = m.team_id
  where m.user_id = v_uid;
  v_has_team := found;
  v_is_leader := v_has_team and v_team.leader_id = v_uid;

  select jsonb_build_object(
    'team', case when v_has_team then jsonb_build_object(
      'id', v_team.id,
      'name', v_team.name,
      'is_leader', v_is_leader,
      'member_count', v_team.member_count,
      'max_members', v_team.max_members
    ) end,
    'listing', (
      select jsonb_build_object(
        'skills', to_jsonb(l.skills),
        'interests', to_jsonb(l.interests),
        'intro', l.intro,
        'preferred_role', l.preferred_role,
        'portfolio_url', l.portfolio_url,
        'updated_at', l.updated_at
      )
      from public.looking_for_team l where l.user_id = v_uid
    ),
    'sent_requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'team_id', r.team_id, 'team_name', t.name, 'status', r.status,
        'created_at', r.created_at, 'responded_at', r.responded_at
      ) order by (r.status = 'pending') desc, r.created_at desc)
      from (
        select * from public.team_requests
        where user_id = v_uid and direction = 'request'
        order by created_at desc limit 100
      ) r
      join public.teams t on t.id = r.team_id
    ), '[]'::jsonb),
    'received_invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'team_id', r.team_id, 'team_name', t.name,
        'leader_name', coalesce(lp.full_name, lp.username),
        'member_count', (select count(*) from public.team_members x where x.team_id = t.id),
        'max_members', t.max_members,
        'status', r.status, 'created_at', r.created_at, 'responded_at', r.responded_at
      ) order by (r.status = 'pending') desc, r.created_at desc)
      from (
        select * from public.team_requests
        where user_id = v_uid and direction = 'invitation'
        order by created_at desc limit 100
      ) r
      join public.teams t on t.id = r.team_id
      join public.profiles lp on lp.id = t.leader_id
    ), '[]'::jsonb),
    'incoming_requests', case when v_is_leader then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'user_name', coalesce(p.full_name, p.username),
        'github_username', p.github_username,
        'status', r.status, 'created_at', r.created_at, 'responded_at', r.responded_at
      ) order by (r.status = 'pending') desc, r.created_at desc)
      from (
        select * from public.team_requests
        where team_id = v_team.id and direction = 'request'
        order by created_at desc limit 100
      ) r
      join public.profiles p on p.id = r.user_id
    ), '[]'::jsonb) end,
    'sent_invitations', case when v_is_leader then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'user_name', coalesce(p.full_name, p.username),
        'status', r.status, 'created_at', r.created_at, 'responded_at', r.responded_at
      ) order by (r.status = 'pending') desc, r.created_at desc)
      from (
        select * from public.team_requests
        where team_id = v_team.id and direction = 'invitation'
        order by created_at desc limit 100
      ) r
      join public.profiles p on p.id = r.user_id
    ), '[]'::jsonb) end
  ) into result;

  return result;
end;
$$;

-- Number of things waiting for the signed-in participant's answer (for a nav badge).
create function public.my_pending_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*) from public.team_requests r
    where r.user_id = auth.uid() and r.direction = 'invitation' and r.status = 'pending'
  )::integer + (
    select count(*) from public.team_requests r
    join public.teams t on t.id = r.team_id
    where t.leader_id = auth.uid() and r.direction = 'request' and r.status = 'pending'
  )::integer;
$$;

-- Function privileges --------------------------------------------------------------

revoke all on function
  public.team_accepts_members(uuid),
  public.on_member_added(),
  public.upsert_looking_listing(uuid, text[], text[], text, text, text),
  public.withdraw_looking_listing(uuid),
  public.request_to_join(uuid, uuid),
  public.send_team_invitation(uuid, uuid),
  public.cancel_team_request(uuid, uuid),
  public.respond_to_team_request(uuid, uuid, boolean),
  public.browse_teams(text, boolean, integer, integer),
  public.browse_seekers(text, text, integer, integer),
  public.my_matching_state(),
  public.my_pending_count()
from public, anon, authenticated;

grant execute on function
  public.upsert_looking_listing(uuid, text[], text[], text, text, text),
  public.withdraw_looking_listing(uuid),
  public.request_to_join(uuid, uuid),
  public.send_team_invitation(uuid, uuid),
  public.cancel_team_request(uuid, uuid),
  public.respond_to_team_request(uuid, uuid, boolean)
to service_role;

grant execute on function
  public.browse_teams(text, boolean, integer, integer),
  public.browse_seekers(text, text, integer, integer),
  public.my_matching_state(),
  public.my_pending_count()
to authenticated;
