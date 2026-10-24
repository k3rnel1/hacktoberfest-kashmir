-- Notifications, removing team members and LinkedIn contact links. Run against a
-- database with all migrations applied. Aborts on the first failed assertion; rolls
-- back at the end.
begin;

create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as
$$ begin if cond is not true then raise exception 'FAIL: %', msg; end if; end $$;

create function pg_temp.raises(sql text, code text) returns boolean language plpgsql as
$$ begin execute sql; return false;
   exception when others then return sqlerrm = code or sqlerrm like code || '%'; end $$;

-- user i  ->  00000000-0000-0000-0000-0000000000ii
create function pg_temp.u(i int) returns uuid language sql as
$$ select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid $$;

-- number of notifications of one type that user i has
create function pg_temp.n(i int, t text) returns bigint language sql as
$$ select count(*) from public.notifications where user_id = pg_temp.u(i) and type = t $$;

-- u1..u9 all have complete profiles. Roles in this script:
--   u1 leads TeamA (later hands over to u4)   u5 leads TeamB
--   u2 joins by request, later leaves         u3 joins by link, is removed, re-invited, removed again
--   u4 joins by invitation, becomes leader    u6 joins by link, removed by an organizer
--   u7 only browses                           u8 joins TeamB, which is then dissolved
--   u9 is only used as the "admin" id
insert into auth.users (id, email, raw_user_meta_data)
select pg_temp.u(i), 'n' || i || '@x.invalid', jsonb_build_object('username', 'nuser' || i)
from generate_series(1, 9) i;
update public.profiles set full_name = 'User ' || right(username, -5), mobile_number = '+919876543210',
  gmail = 'u@gmail.com', github_username = 'gh' || right(username, -5),
  linkedin_url = 'https://www.linkedin.com/in/user' || right(username, -5)
where username like 'nuser%';

set local role service_role;
select public.create_team(pg_temp.u(1), 'aaaaaaaa-0000-0000-0000-000000000001', 'TeamA', 'A description here', 'ha', 5, null);
select public.create_team(pg_temp.u(5), 'aaaaaaaa-0000-0000-0000-000000000002', 'TeamB', 'A description here', 'hb', 3, null);

-- Join requests ---------------------------------------------------------------------
select public.request_to_join(pg_temp.u(2), 'aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.assert(pg_temp.n(1, 'join_request_received') = 1, 'leader told about a new request');
select pg_temp.assert((select body from public.notifications where user_id = pg_temp.u(1) and type = 'join_request_received') like 'User 2 asked to join "TeamA"%', 'request notification names the person and the team');
select public.respond_to_team_request(pg_temp.u(1), (select id from public.team_requests where user_id = pg_temp.u(2) and status = 'pending'), false);
select pg_temp.assert(pg_temp.n(2, 'join_request_rejected') = 1, 'requester told the request was declined');
select public.request_to_join(pg_temp.u(2), 'aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.assert(pg_temp.n(1, 'join_request_received') = 2, 'second request notifies again');
select public.respond_to_team_request(pg_temp.u(1), (select id from public.team_requests where user_id = pg_temp.u(2) and status = 'pending'), true);
select pg_temp.assert(pg_temp.n(2, 'join_request_accepted') = 1, 'requester told the request was accepted');
select pg_temp.assert(pg_temp.n(1, 'member_joined') = 0, 'accepting a request does not also send a "joined" notice to the leader');

select public.request_to_join(pg_temp.u(3), 'aaaaaaaa-0000-0000-0000-000000000001');
select public.cancel_team_request(pg_temp.u(3), (select id from public.team_requests where user_id = pg_temp.u(3) and status = 'pending'));
select pg_temp.assert(pg_temp.n(1, 'join_request_cancelled') = 1, 'leader told a request was withdrawn');

-- Invitations -------------------------------------------------------------------------
select public.upsert_looking_listing(pg_temp.u(4), array['Go'], '{}', '', null, null);
select public.send_team_invitation(pg_temp.u(1), pg_temp.u(4));
select pg_temp.assert(pg_temp.n(4, 'invitation_received') = 1, 'invitee told about the invitation');
select public.cancel_team_request(pg_temp.u(1), (select id from public.team_requests where user_id = pg_temp.u(4) and status = 'pending'));
select pg_temp.assert(pg_temp.n(4, 'invitation_cancelled') = 1, 'invitee told the invitation was cancelled');
select public.send_team_invitation(pg_temp.u(1), pg_temp.u(4));
select public.respond_to_team_request(pg_temp.u(4), (select id from public.team_requests where user_id = pg_temp.u(4) and status = 'pending'), false);
select pg_temp.assert(pg_temp.n(1, 'invitation_rejected') = 1, 'leader told the invitation was declined');
select public.send_team_invitation(pg_temp.u(1), pg_temp.u(4));
select public.respond_to_team_request(pg_temp.u(4), (select id from public.team_requests where user_id = pg_temp.u(4) and status = 'pending'), true);
select pg_temp.assert(pg_temp.n(1, 'invitation_accepted') = 1, 'leader told the invitation was accepted');
select pg_temp.assert(pg_temp.n(1, 'member_joined') = 0, 'accepting an invitation does not also send a "joined" notice');

-- Joining with the invitation link tells the leader
select public.join_team(pg_temp.u(3), 'ha');
select pg_temp.assert(pg_temp.n(1, 'member_joined') = 1, 'leader told someone joined with the link');

-- Removing a member: who may do it ---------------------------------------------------------
select pg_temp.assert(pg_temp.raises($$select public.kick_team_member(pg_temp.u(2), pg_temp.u(3))$$, 'NOT_LEADER'), 'a regular member cannot remove anyone');
select pg_temp.assert(pg_temp.raises($$select public.kick_team_member(pg_temp.u(7), pg_temp.u(3))$$, 'NOT_LEADER'), 'someone without a team cannot remove anyone');
select pg_temp.assert(pg_temp.raises($$select public.kick_team_member(pg_temp.u(5), pg_temp.u(3))$$, 'MEMBER_NOT_FOUND'), 'another team''s leader cannot remove this team''s member');
select pg_temp.assert(pg_temp.raises($$select public.kick_team_member(pg_temp.u(1), pg_temp.u(1))$$, 'CANNOT_REMOVE_SELF'), 'a leader cannot remove themselves');
select pg_temp.assert(pg_temp.raises($$select public.kick_team_member(pg_temp.u(1), pg_temp.u(7))$$, 'MEMBER_NOT_FOUND'), 'cannot remove someone who is not on the team');
select pg_temp.assert((select count(*) from public.team_members where team_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 4, 'failed removals changed nothing');

-- Removing a member: effects ---------------------------------------------------------------
select public.kick_team_member(pg_temp.u(1), pg_temp.u(3));
select pg_temp.assert(not exists (select 1 from public.team_members where user_id = pg_temp.u(3)), 'removed member is off the team');
select pg_temp.assert((select count(*) from public.team_members where team_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 3, 'team shrinks by one');
select pg_temp.assert(pg_temp.n(3, 'removed_from_team') = 1, 'removed member is notified');
select pg_temp.assert(exists (select 1 from public.team_removals where team_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = pg_temp.u(3)), 'removal is recorded');

-- A removed person cannot walk straight back in
select pg_temp.assert(pg_temp.raises($$select public.join_team(pg_temp.u(3), 'ha')$$, 'REMOVED_FROM_TEAM'), 'cannot rejoin with the invitation link');
select pg_temp.assert(pg_temp.raises($$select public.request_to_join(pg_temp.u(3), 'aaaaaaaa-0000-0000-0000-000000000001')$$, 'REMOVED_FROM_TEAM'), 'cannot send a request to the same team');
select public.request_to_join(pg_temp.u(3), 'aaaaaaaa-0000-0000-0000-000000000002');
select pg_temp.assert(pg_temp.n(5, 'join_request_received') = 1, 'other teams can still be asked');
select public.cancel_team_request(pg_temp.u(3), (select id from public.team_requests where user_id = pg_temp.u(3) and status = 'pending'));

-- ...but the leader can invite them back, which lifts the block
select public.upsert_looking_listing(pg_temp.u(3), array['Rust'], '{}', '', null, null);
select public.send_team_invitation(pg_temp.u(1), pg_temp.u(3));
select pg_temp.assert(not exists (select 1 from public.team_removals where user_id = pg_temp.u(3)), 'a direct invitation lifts the removal');
select public.respond_to_team_request(pg_temp.u(3), (select id from public.team_requests where user_id = pg_temp.u(3) and direction = 'invitation' and status = 'pending'), true);
select pg_temp.assert((select team_id from public.team_members where user_id = pg_temp.u(3)) = 'aaaaaaaa-0000-0000-0000-000000000001', 'invited-back member is on the team again');

-- Leaving, leadership, organizer actions ------------------------------------------------------
select public.join_team(pg_temp.u(6), 'ha');
select pg_temp.assert(pg_temp.n(1, 'member_joined') = 2, 'second link join notifies the leader');

select public.leave_team(pg_temp.u(2));
select pg_temp.assert(pg_temp.n(1, 'member_left') = 1, 'leader told a member left');

select public.transfer_leadership(pg_temp.u(1), pg_temp.u(4));
select pg_temp.assert(pg_temp.n(4, 'leadership_transferred') = 1, 'new leader is notified');
select pg_temp.assert(pg_temp.raises($$select public.kick_team_member(pg_temp.u(1), pg_temp.u(3))$$, 'NOT_LEADER'), 'former leader can no longer remove members');

-- Selection status: every member of the team is told, other teams are not
select public.admin_set_team_status(pg_temp.u(9), 'aaaaaaaa-0000-0000-0000-000000000001', 'selected');
select pg_temp.assert(pg_temp.n(1, 'selection_status') = 1 and pg_temp.n(3, 'selection_status') = 1
                      and pg_temp.n(4, 'selection_status') = 1 and pg_temp.n(6, 'selection_status') = 1, 'every team member is told the new status');
select pg_temp.assert(pg_temp.n(5, 'selection_status') = 0, 'other teams are not told');
select pg_temp.assert((select title from public.notifications where user_id = pg_temp.u(3) and type = 'selection_status') = 'Selection status: Selected', 'status notification title');
select public.admin_set_team_status(pg_temp.u(9), 'aaaaaaaa-0000-0000-0000-000000000001', 'selected');
select pg_temp.assert(pg_temp.n(3, 'selection_status') = 1, 're-saving the same status sends nothing');
select public.admin_set_team_status(pg_temp.u(9), 'aaaaaaaa-0000-0000-0000-000000000001', 'on_hold');
select pg_temp.assert(pg_temp.n(3, 'selection_status') = 2, 'a changed status notifies again');

select public.admin_remove_member(pg_temp.u(9), pg_temp.u(6));
select pg_temp.assert(pg_temp.n(6, 'removed_from_team') = 1, 'member removed by an organizer is notified');
select pg_temp.assert(not exists (select 1 from public.team_removals where user_id = pg_temp.u(6)), 'an organizer removal does not block rejoining');

-- Dissolving a team tells its members, and the notice outlives the team
select public.join_team(pg_temp.u(8), 'hb');
select pg_temp.assert(pg_temp.n(5, 'member_joined') = 1, 'TeamB leader told about the link join');
select public.dissolve_team(pg_temp.u(5), 'aaaaaaaa-0000-0000-0000-000000000002');
select pg_temp.assert(pg_temp.n(8, 'team_dissolved') = 1, 'members are told the team was dissolved');
select pg_temp.assert(pg_temp.n(5, 'team_dissolved') = 0, 'the leader who dissolved it is not notified');

-- Removing a second time (by the new leader) is recorded again
select public.kick_team_member(pg_temp.u(4), pg_temp.u(3));
select pg_temp.assert(pg_temp.n(3, 'removed_from_team') = 2, 'second removal notifies again');

-- Marking as read ------------------------------------------------------------------------------
select public.upsert_looking_listing(pg_temp.u(2), array['React'], '{}', '', null, null);
select public.upsert_looking_listing(pg_temp.u(7), array['Go'], '{}', '', null, null);
select pg_temp.assert(public.mark_notifications_read(pg_temp.u(1)) > 0, 'mark all read returns how many changed');
select pg_temp.assert(public.mark_notifications_read(pg_temp.u(1)) = 0, 'nothing left to mark');
select pg_temp.assert(not exists (select 1 from public.notifications where user_id = pg_temp.u(1) and read_at is null), 'all of the user''s notifications are read');
select pg_temp.assert(public.mark_notifications_read(pg_temp.u(1), array[(select id from public.notifications where user_id = pg_temp.u(4) order by id limit 1)]) = 0, 'cannot mark someone else''s notification');
select pg_temp.assert(public.mark_notifications_read(pg_temp.u(4), array[(select id from public.notifications where user_id = pg_temp.u(4) order by id limit 1)]) = 1, 'can mark your own notification');

select set_config('t.u4_total', (select count(*)::text from public.notifications where user_id = pg_temp.u(4)), true);
select set_config('t.u4_unread', (select count(*)::text from public.notifications where user_id = pg_temp.u(4) and read_at is null), true);

-- Browser access -------------------------------------------------------------------------------
reset role; set local role authenticated;
select pg_temp.assert(pg_temp.raises($$select * from public.notifications$$, 'permission denied'), 'notifications not readable directly');
select pg_temp.assert(pg_temp.raises($$update public.notifications set read_at = null$$, 'permission denied'), 'notifications not editable directly');
select pg_temp.assert(pg_temp.raises($$insert into public.notifications (user_id, type, title) values (pg_temp.u(7), 'x', 'forged')$$, 'permission denied'), 'notifications cannot be forged from a browser');
select pg_temp.assert(pg_temp.raises($$select * from public.team_removals$$, 'permission denied'), 'removals not readable directly');
select pg_temp.assert(pg_temp.raises($$select public.kick_team_member(pg_temp.u(4), pg_temp.u(3))$$, 'permission denied'), 'kick is not callable by browsers');
select pg_temp.assert(pg_temp.raises($$select public.mark_notifications_read(pg_temp.u(4))$$, 'permission denied'), 'mark-read is not callable by browsers');
select pg_temp.assert(pg_temp.raises($$select public.push_notification(pg_temp.u(4), 'x', 'forged', 'forged')$$, 'permission denied'), 'the notification helper is not callable by browsers');

-- Each person sees only their own notifications
select set_config('request.jwt.claim.sub', pg_temp.u(4)::text, true);
select pg_temp.assert((public.my_notifications()->>'total')::int = current_setting('t.u4_total')::int, 'inbox total matches');
select pg_temp.assert((public.my_notifications()->>'unread')::int = current_setting('t.u4_unread')::int, 'inbox unread count matches');
select pg_temp.assert(public.my_unread_notification_count() = current_setting('t.u4_unread')::int, 'badge count matches');
select pg_temp.assert(jsonb_array_length(public.my_notifications()->'items') = current_setting('t.u4_total')::int, 'every notification is listed');
select pg_temp.assert(public.my_notifications()::text !~ '(mobile|gmail|@|user_id)', 'inbox leaks no contact details or ids');
select set_config('request.jwt.claim.sub', pg_temp.u(9)::text, true);
select pg_temp.assert((public.my_notifications()->>'total')::int = 0, 'someone else''s notifications are not visible');
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.assert((public.my_notifications()->>'total')::int = 0 and public.my_unread_notification_count() = 0, 'signed-out sees no notifications');

-- LinkedIn on Browse Teams (leader) and Looking for a Team (participant)
select set_config('request.jwt.claim.sub', pg_temp.u(7)::text, true);
select pg_temp.assert(public.browse_teams()::text like '%https://www.linkedin.com/in/user4%', 'browse shows the current team leader''s LinkedIn');
select pg_temp.assert(public.browse_teams()::text !~ '(mobile|gmail|@)', 'browse teams still leaks no phone or email');
select pg_temp.assert(public.browse_seekers()::text like '%https://www.linkedin.com/in/user2%', 'seekers show LinkedIn');
select pg_temp.assert(public.browse_seekers()::text !~ '(mobile|gmail|@)', 'seekers still leak no phone or email');
select pg_temp.assert(not (select bool_or((t->>'was_removed')::boolean) from jsonb_array_elements(public.browse_teams()->'teams') t), 'was_removed is false for someone who was never removed');

-- The removed person is told on the team card
select set_config('request.jwt.claim.sub', pg_temp.u(3)::text, true);
select pg_temp.assert((select (t->>'was_removed')::boolean from jsonb_array_elements(public.browse_teams()->'teams') t where t->>'name' = 'TeamA'), 'removed person sees the removal flag');
select pg_temp.assert((public.my_matching_state()->'received_invitations')::text like '%"leader_linkedin_url": "https://www.linkedin.com/in/user4"%', 'invitations show the leader''s LinkedIn');

-- The leader sees LinkedIn of requesters and invitees
select set_config('request.jwt.claim.sub', pg_temp.u(4)::text, true);
select pg_temp.assert((public.my_matching_state()->'incoming_requests')::text like '%https://www.linkedin.com/in/user2%', 'leader sees the requester''s LinkedIn');
select pg_temp.assert((public.my_matching_state()->'sent_invitations')::text like '%https://www.linkedin.com/in/user%', 'leader sees the invitee''s LinkedIn');
reset role;

select 'ALL NOTIFICATION AND REMOVAL CHECKS PASSED' as result;
rollback;
