-- Hacktoberfest Kashmir: notifications, removing team members, and contact links.
--
-- 1. A notifications inbox. Notifications are written by the same database functions
--    that perform the action (request sent, accepted, rejected, member removed, team
--    selection status changed, ...), inside the same transaction, so they can never be
--    missed or forged from a browser. Reads go through SECURITY DEFINER functions that
--    use auth.uid(); marking as read is a service_role function called from a server
--    action. The table has RLS on and no grants for anon/authenticated.
-- 2. Team leaders can remove (kick) a member. A removed participant cannot rejoin that
--    team by invitation link or by sending a request; only a direct invitation from the
--    leader lifts the block.
-- 3. LinkedIn profile links (from the participant's own profile) are returned by the
--    "Browse teams" (team leader) and "Looking for a team" (participant) reads, so
--    participants can contact each other. Phone numbers and emails are still never
--    returned.
--
-- Apply once, after 20261023000002_team_matching.sql. Existing functions are replaced
-- in place (same signatures), so their grants are kept.

-- Tables ------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  -- Internal path only (for example /teams/requests); never an external URL.
  link text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),

  constraint notifications_type_len check (char_length(type) between 1 and 40),
  constraint notifications_title_len check (char_length(title) between 1 and 200),
  constraint notifications_body_len check (char_length(body) <= 600),
  constraint notifications_link_format check (link is null or link ~ '^/[A-Za-z0-9_-]+(/[A-Za-z0-9_-]+)*$')
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- Remembers who a team leader removed, so the person cannot simply rejoin with the
-- team's invitation link. Deleted with the team or the profile.
create table public.team_removals (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  removed_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

alter table public.notifications enable row level security;
alter table public.team_removals enable row level security;

revoke all on public.notifications, public.team_removals from anon, authenticated;
grant all on public.notifications, public.team_removals to service_role;

-- Internal helpers (no grants: only called from the functions below) -----------------

create function public.display_name(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nullif(btrim(full_name), ''), username)
  from public.profiles
  where id = p_user_id;
$$;

create function public.push_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_link text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.notifications (user_id, type, title, body, link, metadata)
  values (
    p_user_id, p_type, left(p_title, 200), left(coalesce(p_body, ''), 600), p_link,
    coalesce(p_metadata, '{}'::jsonb)
  );

  -- Opportunistic cleanup of very old notifications.
  if random() < 0.02 then
    delete from public.notifications where created_at < now() - interval '90 days';
  end if;
end;
$$;

-- Membership trigger ---------------------------------------------------------------
-- Keeps listings and open requests consistent (as before) and tells the leader when
-- someone joins with the invitation link. Joins that come from an accepted request or
-- invitation already produce their own notification, so those are skipped here: the
-- accepted request row was written earlier in this same transaction.

create or replace function public.on_member_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_leader uuid;
  v_team_name text;
begin
  delete from public.looking_for_team where user_id = new.user_id;
  update public.team_requests
  set status = 'cancelled', responded_at = now()
  where user_id = new.user_id and status = 'pending';
  delete from public.team_removals where team_id = new.team_id and user_id = new.user_id;

  if new.role = 'member'
     and not exists (
       select 1 from public.team_requests r
       where r.team_id = new.team_id and r.user_id = new.user_id
         and r.status = 'accepted' and r.responded_at = now()
     ) then
    select leader_id, name into v_leader, v_team_name from public.teams where id = new.team_id;
    perform public.push_notification(
      v_leader, 'member_joined', 'New team member',
      public.display_name(new.user_id) || ' joined "' || v_team_name || '" with your invitation link.',
      '/team/' || new.team_id::text,
      jsonb_build_object('team_id', new.team_id, 'user_id', new.user_id)
    );
  end if;

  return new;
end;
$$;

-- Joining ------------------------------------------------------------------------------

-- Same as before, plus: a participant removed by the leader cannot rejoin by link.
create or replace function public.join_team(p_user_id uuid, p_token_hash text)
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

  if exists (select 1 from public.team_removals where team_id = t.id and user_id = p_user_id) then
    raise exception 'REMOVED_FROM_TEAM';
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

-- Requests and invitations ------------------------------------------------------------

create or replace function public.request_to_join(p_user_id uuid, p_team_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_team uuid;
  v_id uuid;
  v_leader uuid;
  v_team_name text;
begin
  -- Same lock as join_team: capacity checks for one team are serialised.
  select leader_id, name into v_leader, v_team_name
  from public.teams where id = p_team_id for update;
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

  if exists (select 1 from public.team_removals where team_id = p_team_id and user_id = p_user_id) then
    raise exception 'REMOVED_FROM_TEAM';
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

  perform public.push_notification(
    v_leader, 'join_request_received', 'New request to join your team',
    public.display_name(p_user_id) || ' asked to join "' || v_team_name || '".',
    '/teams/requests',
    jsonb_build_object('team_id', p_team_id, 'request_id', v_id, 'user_id', p_user_id)
  );

  return v_id;
end;
$$;

-- The invitation is always sent for the caller's own team (derived here, never
-- passed in), so a leader cannot act for another team. An explicit invitation lifts
-- an earlier removal: the leader is choosing to welcome the person back.
create or replace function public.send_team_invitation(p_leader_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_team_name text;
  v_id uuid;
begin
  select id, name into v_team, v_team_name
  from public.teams where leader_id = p_leader_id for update;
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

  delete from public.team_removals where team_id = v_team and user_id = p_user_id;

  perform public.push_notification(
    p_user_id, 'invitation_received', 'You were invited to a team',
    public.display_name(p_leader_id) || ' invited you to join "' || v_team_name || '".',
    '/teams/requests',
    jsonb_build_object('team_id', v_team, 'request_id', v_id)
  );

  return v_id;
end;
$$;

-- Cancel: the participant cancels their own request; the leader cancels an
-- invitation their team sent. The other side is told.
create or replace function public.cancel_team_request(p_actor_id uuid, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.team_requests%rowtype;
  v_leader uuid;
  v_team_name text;
begin
  select * into r from public.team_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  select leader_id, name into v_leader, v_team_name from public.teams where id = r.team_id;

  if not ((r.direction = 'request' and r.user_id = p_actor_id)
          or (r.direction = 'invitation' and v_leader = p_actor_id)) then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if r.status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING';
  end if;

  update public.team_requests set status = 'cancelled', responded_at = now() where id = r.id;

  if r.direction = 'request' then
    perform public.push_notification(
      v_leader, 'join_request_cancelled', 'Join request withdrawn',
      public.display_name(r.user_id) || ' withdrew their request to join "' || v_team_name || '".',
      '/teams/requests',
      jsonb_build_object('team_id', r.team_id, 'request_id', r.id)
    );
  else
    perform public.push_notification(
      r.user_id, 'invitation_cancelled', 'Invitation cancelled',
      'The invitation to join "' || v_team_name || '" was cancelled by the team leader.',
      '/teams/requests',
      jsonb_build_object('team_id', r.team_id, 'request_id', r.id)
    );
  end if;
end;
$$;

-- Accept / reject: the team leader answers a request; the invited participant
-- answers an invitation. Acceptance rechecks everything under the team row lock.
-- The person who sent the request or invitation is told the outcome.
create or replace function public.respond_to_team_request(p_actor_id uuid, p_request_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  r public.team_requests%rowtype;
  v_leader uuid;
  v_team_name text;
begin
  select team_id into v_team from public.team_requests where id = p_request_id;
  if v_team is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  -- Lock order is always team, then request, to avoid deadlocks.
  select leader_id, name into v_leader, v_team_name
  from public.teams where id = v_team for update;
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

    if r.direction = 'request' then
      perform public.push_notification(
        r.user_id, 'join_request_rejected', 'Join request declined',
        'Your request to join "' || v_team_name || '" was declined.',
        '/teams/requests',
        jsonb_build_object('team_id', r.team_id, 'request_id', r.id)
      );
    else
      perform public.push_notification(
        v_leader, 'invitation_rejected', 'Invitation declined',
        public.display_name(r.user_id) || ' declined your invitation to join "' || v_team_name || '".',
        '/teams/requests',
        jsonb_build_object('team_id', r.team_id, 'request_id', r.id)
      );
    end if;
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

  if r.direction = 'request' then
    perform public.push_notification(
      r.user_id, 'join_request_accepted', 'Join request accepted',
      'You are now a member of "' || v_team_name || '".',
      '/team/' || r.team_id::text,
      jsonb_build_object('team_id', r.team_id, 'request_id', r.id)
    );
  else
    perform public.push_notification(
      v_leader, 'invitation_accepted', 'Invitation accepted',
      public.display_name(r.user_id) || ' accepted your invitation and joined "' || v_team_name || '".',
      '/team/' || r.team_id::text,
      jsonb_build_object('team_id', r.team_id, 'request_id', r.id)
    );
  end if;

  return r.team_id;
end;
$$;

-- Leaving, removing, leadership --------------------------------------------------------

create or replace function public.leave_team(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_role text;
  v_leader uuid;
  v_team_name text;
begin
  select team_id into v_team from public.team_members where user_id = p_user_id;
  if v_team is null then
    raise exception 'NOT_IN_TEAM';
  end if;

  select leader_id, name into v_leader, v_team_name
  from public.teams where id = v_team for update;

  select role into v_role from public.team_members where user_id = p_user_id;
  if v_role is null then
    raise exception 'NOT_IN_TEAM';
  end if;
  if v_role = 'leader' then
    raise exception 'LEADER_CANNOT_LEAVE';
  end if;

  delete from public.team_members where user_id = p_user_id;

  perform public.push_notification(
    v_leader, 'member_left', 'A member left your team',
    public.display_name(p_user_id) || ' left "' || v_team_name || '".',
    '/team/' || v_team::text,
    jsonb_build_object('team_id', v_team, 'user_id', p_user_id)
  );
end;
$$;

-- A team leader removes a member of their own team. The team is derived from the
-- caller's leadership (never passed in), so a leader cannot act on another team.
create function public.kick_team_member(p_leader_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_team_name text;
begin
  select id, name into v_team, v_team_name
  from public.teams where leader_id = p_leader_id for update;
  if v_team is null then
    raise exception 'NOT_LEADER';
  end if;
  if p_user_id = p_leader_id then
    raise exception 'CANNOT_REMOVE_SELF';
  end if;
  if not exists (
    select 1 from public.team_members where team_id = v_team and user_id = p_user_id
  ) then
    raise exception 'MEMBER_NOT_FOUND';
  end if;

  delete from public.team_members where team_id = v_team and user_id = p_user_id;

  insert into public.team_removals (team_id, user_id)
  values (v_team, p_user_id)
  on conflict (team_id, user_id) do update set removed_at = now();

  perform public.push_notification(
    p_user_id, 'removed_from_team', 'You were removed from a team',
    'The leader of "' || v_team_name || '" removed you from the team. You can still join or request other teams.',
    '/teams',
    jsonb_build_object('team_id', v_team)
  );
end;
$$;

create or replace function public.transfer_leadership(p_actor_id uuid, p_new_leader_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_team_name text;
begin
  select team_id into v_team from public.team_members where user_id = p_actor_id and role = 'leader';
  if v_team is null then
    raise exception 'NOT_LEADER';
  end if;

  select name into v_team_name from public.teams where id = v_team for update;

  if p_new_leader_id = p_actor_id
     or not exists (select 1 from public.team_members where team_id = v_team and user_id = p_new_leader_id) then
    raise exception 'TARGET_NOT_MEMBER';
  end if;

  update public.team_members set role = 'member' where team_id = v_team and user_id = p_actor_id;
  update public.team_members set role = 'leader' where team_id = v_team and user_id = p_new_leader_id;
  update public.teams set leader_id = p_new_leader_id where id = v_team;

  perform public.push_notification(
    p_new_leader_id, 'leadership_transferred', 'You are now the team leader',
    public.display_name(p_actor_id) || ' made you the leader of "' || v_team_name || '".',
    '/team/' || v_team::text,
    jsonb_build_object('team_id', v_team)
  );
end;
$$;

create or replace function public.dissolve_team(p_actor_id uuid, p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team_name text;
begin
  select name into v_team_name from public.teams
  where id = p_team_id and leader_id = p_actor_id for update;
  if not found then
    raise exception 'NOT_LEADER';
  end if;

  -- Notifications do not reference the team, so they outlive it.
  insert into public.notifications (user_id, type, title, body, link, metadata)
  select m.user_id, 'team_dissolved', 'Your team was dissolved',
         'The team leader dissolved "' || v_team_name || '".',
         '/dashboard', jsonb_build_object('team_name', v_team_name)
  from public.team_members m
  where m.team_id = p_team_id and m.user_id <> p_actor_id;

  delete from public.teams where id = p_team_id;
end;
$$;

-- Admin tools ------------------------------------------------------------------------

create or replace function public.admin_remove_member(p_admin_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team uuid;
  v_role text;
  v_team_name text;
begin
  select team_id into v_team from public.team_members where user_id = p_user_id;
  if v_team is null then
    raise exception 'NOT_IN_TEAM';
  end if;

  select name into v_team_name from public.teams where id = v_team for update;

  select role into v_role from public.team_members where user_id = p_user_id;
  if v_role is null then
    raise exception 'NOT_IN_TEAM';
  end if;
  if v_role = 'leader' then
    raise exception 'REMOVE_LEADER_BLOCKED';
  end if;

  delete from public.team_members where user_id = p_user_id;
  perform public.admin_log(p_admin_id, 'remove_member', 'user', p_user_id::text, jsonb_build_object('team_id', v_team));

  perform public.push_notification(
    p_user_id, 'removed_from_team', 'You were removed from a team',
    'An organizer removed you from "' || v_team_name || '".',
    '/dashboard',
    jsonb_build_object('team_id', v_team)
  );
end;
$$;

create or replace function public.admin_dissolve_team(p_admin_id uuid, p_team_id uuid)
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

  insert into public.notifications (user_id, type, title, body, link, metadata)
  select m.user_id, 'team_dissolved', 'Your team was dissolved',
         'An organizer dissolved "' || v_name || '".',
         '/dashboard', jsonb_build_object('team_name', v_name)
  from public.team_members m
  where m.team_id = p_team_id;

  delete from public.teams where id = p_team_id;
  perform public.admin_log(
    p_admin_id, 'dissolve_team', 'team', p_team_id::text,
    jsonb_build_object('team_name', v_name, 'member_count', v_count)
  );
end;
$$;

-- Changing the selection status tells every member of the team.
create or replace function public.admin_set_team_status(
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
  v_name text;
begin
  if p_status is null or p_status not in ('in_process', 'selected', 'on_hold', 'rejected') then
    raise exception 'INVALID_STATUS';
  end if;

  select selection_status, name into v_old, v_name
  from public.teams where id = p_team_id for update;
  if not found then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  -- Re-saving the current status changes nothing, is not audited and sends nothing.
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

  insert into public.notifications (user_id, type, title, body, link, metadata)
  select m.user_id, 'selection_status',
         'Selection status: ' || case p_status
           when 'in_process' then 'In Process'
           when 'selected' then 'Selected'
           when 'on_hold' then 'On Hold'
           else 'Rejected'
         end,
         case p_status
           when 'selected' then 'Congratulations! Your team "' || v_name || '" has been selected for Hacktoberfest Kashmir.'
           when 'on_hold' then 'Your team "' || v_name || '" is on hold for now. You will be notified if that changes.'
           when 'rejected' then 'Unfortunately, your team "' || v_name || '" was not selected this time. Thank you for applying.'
           else 'Your team "' || v_name || '" is being reviewed.'
         end,
         '/team/' || p_team_id::text,
         jsonb_build_object('team_id', p_team_id, 'status', p_status)
  from public.team_members m
  where m.team_id = p_team_id;
end;
$$;

-- Notification inbox (reads: authenticated; marking read: service_role) -------------------

create function public.my_notifications(p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  result jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('unread', 0, 'total', 0, 'items', '[]'::jsonb);
  end if;

  select jsonb_build_object(
    'unread', (select count(*) from public.notifications n where n.user_id = v_uid and n.read_at is null),
    'total', (select count(*) from public.notifications n where n.user_id = v_uid),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'type', x.type,
          'title', x.title,
          'body', x.body,
          'link', x.link,
          'is_read', x.read_at is not null,
          'created_at', x.created_at
        )
        order by x.created_at desc, x.id
      )
      from (
        select * from public.notifications n
        where n.user_id = v_uid
        order by n.created_at desc, n.id
        limit least(greatest(coalesce(p_limit, 50), 1), 200)
        offset greatest(coalesce(p_offset, 0), 0)
      ) x
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

create function public.my_unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.notifications
  where user_id = auth.uid() and read_at is null;
$$;

-- p_ids null marks everything as read. Only the caller's own rows are ever touched.
create function public.mark_notifications_read(p_user_id uuid, p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.notifications
  set read_at = now()
  where user_id = p_user_id
    and read_at is null
    and (p_ids is null or id = any (p_ids));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Reads with contact links (LinkedIn only; never phone numbers or emails) -----------------

create or replace function public.browse_teams(
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
           lp.linkedin_url as leader_linkedin_url,
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
          'leader_linkedin_url', f.leader_linkedin_url,
          'was_removed', exists (
            select 1 from public.team_removals rm where rm.team_id = f.id and rm.user_id = v_uid
          ),
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

create or replace function public.browse_seekers(
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
    select l.*, p.full_name, p.username, p.github_username, p.linkedin_url
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
          'linkedin_url', b.linkedin_url,
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

create or replace function public.my_matching_state()
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
        'leader_linkedin_url', lp.linkedin_url,
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
        'linkedin_url', p.linkedin_url,
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
        'linkedin_url', p.linkedin_url,
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


-- Function privileges ---------------------------------------------------------------------

revoke all on function
  public.display_name(uuid),
  public.push_notification(uuid, text, text, text, text, jsonb),
  public.kick_team_member(uuid, uuid),
  public.mark_notifications_read(uuid, uuid[]),
  public.my_notifications(integer, integer),
  public.my_unread_notification_count()
from public, anon, authenticated;

grant execute on function
  public.kick_team_member(uuid, uuid),
  public.mark_notifications_read(uuid, uuid[])
to service_role;

grant execute on function
  public.my_notifications(integer, integer),
  public.my_unread_notification_count()
to authenticated;
