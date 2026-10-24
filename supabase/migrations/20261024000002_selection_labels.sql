-- Hacktoberfest Kashmir: rename two selection statuses in what people see.
--
--   on_hold  -> "Under Review"
--   rejected -> "Not Selected"
--
-- Only the display text changes. The stored values (on_hold, rejected) stay the same,
-- so existing data, filters, audit entries and URLs keep working. This replaces
-- admin_set_team_status in place (same signature, grants kept) so new notifications use
-- the new names, and it rewrites the titles of notifications already sent.
-- Apply once, after 20261024000001_notifications_kick_linkedin.sql.

-- Changing the selection status tells every member of the team (display names updated).
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
           when 'on_hold' then 'Under Review'
           else 'Not Selected'
         end,
         case p_status
           when 'selected' then 'Congratulations! Your team "' || v_name || '" has been selected for Hacktoberfest Kashmir.'
           when 'on_hold' then 'Your team "' || v_name || '" is under review. You will be notified when a decision is made.'
           when 'rejected' then 'Unfortunately, your team "' || v_name || '" was not selected this time. Thank you for applying.'
           else 'Your team "' || v_name || '" is being reviewed.'
         end,
         '/team/' || p_team_id::text,
         jsonb_build_object('team_id', p_team_id, 'status', p_status)
  from public.team_members m
  where m.team_id = p_team_id;
end;
$$;

-- Notifications already in inboxes ----------------------------------------------------------

update public.notifications
set title = case metadata ->> 'status'
      when 'on_hold' then 'Selection status: Under Review'
      when 'rejected' then 'Selection status: Not Selected'
    end,
    body = replace(body, 'is on hold for now. You will be notified if that changes.',
                         'is under review. You will be notified when a decision is made.')
where type = 'selection_status' and metadata ->> 'status' in ('on_hold', 'rejected');
