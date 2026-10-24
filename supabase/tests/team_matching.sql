-- Team matching checks (requests, invitations, listings). Run against a database with
-- all migrations applied. Aborts on the first failed assertion; rolls back at the end.
begin;

create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as
$$ begin if cond is not true then raise exception 'FAIL: %', msg; end if; end $$;

create function pg_temp.raises(sql text, code text) returns boolean language plpgsql as
$$ begin execute sql; return false;
   exception when others then return sqlerrm = code or sqlerrm like code || '%'; end $$;

-- a..j complete profiles, k incomplete. Ids end in the letter's hex digit position.
insert into auth.users (id, email, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'u' || i || '@x.invalid',
       jsonb_build_object('username', 'user' || i)
from generate_series(1, 11) i;
update public.profiles set full_name = 'User ' || right(username, -4), mobile_number = '+919876543210',
  gmail = 'u@gmail.com', github_username = 'gh' || right(username, -4),
  linkedin_url = 'https://www.linkedin.com/in/user' || right(username, -4)
where username <> 'user11';

-- u1 leads TeamA (max 2), u3 leads TeamB (max 2), u8 leads TeamC (max 3), u9 leads TeamD (max 3)
set local role service_role;
select public.create_team('00000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','TeamA','A description here','ha',2,null);
select public.create_team('00000000-0000-0000-0000-000000000003','aaaaaaaa-0000-0000-0000-000000000003','TeamB','A description here','hb',2,null);
select public.create_team('00000000-0000-0000-0000-000000000008','aaaaaaaa-0000-0000-0000-000000000008','TeamC','A description here','hc',3,null);
select public.create_team('00000000-0000-0000-0000-000000000009','aaaaaaaa-0000-0000-0000-000000000009','TeamD','A description here','hd',3,null);

-- Requests ----------------------------------------------------------------------
select pg_temp.assert(pg_temp.raises($$select public.request_to_join('00000000-0000-0000-0000-000000000002','aaaaaaaa-9999-0000-0000-000000000000')$$,'TEAM_NOT_FOUND'),'unknown team');
select pg_temp.assert(pg_temp.raises($$select public.request_to_join('00000000-0000-0000-0000-000000000011','aaaaaaaa-0000-0000-0000-000000000001')$$,'PROFILE_INCOMPLETE'),'incomplete profile cannot request');
select pg_temp.assert(pg_temp.raises($$select public.request_to_join('00000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001')$$,'ALREADY_MEMBER'),'cannot request own team');
select pg_temp.assert(pg_temp.raises($$select public.request_to_join('00000000-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000003')$$,'ALREADY_IN_TEAM'),'member of another team cannot request');

select public.request_to_join('00000000-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.assert(pg_temp.raises($$select public.request_to_join('00000000-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001')$$,'DUPLICATE_REQUEST'),'no duplicate pending request');

-- authorisation of the answer
select pg_temp.assert(pg_temp.raises($$select public.respond_to_team_request('00000000-0000-0000-0000-000000000004',(select id from public.team_requests limit 1),true)$$,'REQUEST_NOT_FOUND'),'stranger cannot accept');
select pg_temp.assert(pg_temp.raises($$select public.respond_to_team_request('00000000-0000-0000-0000-000000000003',(select id from public.team_requests limit 1),true)$$,'REQUEST_NOT_FOUND'),'another team''s leader cannot accept');
select pg_temp.assert(pg_temp.raises($$select public.respond_to_team_request('00000000-0000-0000-0000-000000000002',(select id from public.team_requests limit 1),true)$$,'REQUEST_NOT_FOUND'),'requester cannot accept own request');
select pg_temp.assert(pg_temp.raises($$select public.cancel_team_request('00000000-0000-0000-0000-000000000001',(select id from public.team_requests limit 1))$$,'REQUEST_NOT_FOUND'),'leader cannot cancel a participant request');

select public.respond_to_team_request('00000000-0000-0000-0000-000000000001',(select id from public.team_requests where user_id='00000000-0000-0000-0000-000000000002'),true);
select pg_temp.assert((select count(*) from public.team_members where team_id='aaaaaaaa-0000-0000-0000-000000000001')=2,'accepted request adds the member');
select pg_temp.assert((select status from public.team_requests where user_id='00000000-0000-0000-0000-000000000002')='accepted','request marked accepted');
select pg_temp.assert(pg_temp.raises($$select public.respond_to_team_request('00000000-0000-0000-0000-000000000001',(select id from public.team_requests where user_id='00000000-0000-0000-0000-000000000002'),true)$$,'REQUEST_NOT_PENDING'),'cannot answer twice');
select pg_temp.assert(pg_temp.raises($$select public.request_to_join('00000000-0000-0000-0000-000000000004','aaaaaaaa-0000-0000-0000-000000000001')$$,'TEAM_FULL'),'full team refuses requests');

-- Capacity under competing requests: two pending requests, one slot
select public.request_to_join('00000000-0000-0000-0000-000000000004','aaaaaaaa-0000-0000-0000-000000000003');
select public.request_to_join('00000000-0000-0000-0000-000000000005','aaaaaaaa-0000-0000-0000-000000000003');
select public.respond_to_team_request('00000000-0000-0000-0000-000000000003',(select id from public.team_requests where user_id='00000000-0000-0000-0000-000000000004' and status='pending'),true);
select pg_temp.assert(pg_temp.raises($$select public.respond_to_team_request('00000000-0000-0000-0000-000000000003',(select id from public.team_requests where user_id='00000000-0000-0000-0000-000000000005' and status='pending'),true)$$,'TEAM_FULL'),'last slot cannot be given twice');
select pg_temp.assert((select count(*) from public.team_members where team_id='aaaaaaaa-0000-0000-0000-000000000003')=2,'team never exceeds max_members');
select public.respond_to_team_request('00000000-0000-0000-0000-000000000003',(select id from public.team_requests where user_id='00000000-0000-0000-0000-000000000005' and status='pending'),false);
select pg_temp.assert((select status from public.team_requests where user_id='00000000-0000-0000-0000-000000000005')='rejected','reject works on a full team');
-- rejected requests can be repeated later
select public.request_to_join('00000000-0000-0000-0000-000000000005','aaaaaaaa-0000-0000-0000-000000000008');
select public.cancel_team_request('00000000-0000-0000-0000-000000000005',(select id from public.team_requests where user_id='00000000-0000-0000-0000-000000000005' and status='pending'));
select pg_temp.assert((select status from public.team_requests where user_id='00000000-0000-0000-0000-000000000005' and team_id='aaaaaaaa-0000-0000-0000-000000000008')='cancelled','participant can cancel own pending request');
select pg_temp.assert(pg_temp.raises($$select public.cancel_team_request('00000000-0000-0000-0000-000000000005',(select id from public.team_requests where team_id='aaaaaaaa-0000-0000-0000-000000000008'))$$,'REQUEST_NOT_PENDING'),'cannot cancel twice');

-- Listings ----------------------------------------------------------------------
select pg_temp.assert(pg_temp.raises($$select public.upsert_looking_listing('00000000-0000-0000-0000-000000000001',array['sql'],'{}','hi',null,null)$$,'ALREADY_IN_TEAM'),'team members cannot list');
select pg_temp.assert(pg_temp.raises($$select public.upsert_looking_listing('00000000-0000-0000-0000-000000000011',array['sql'],'{}','hi',null,null)$$,'PROFILE_INCOMPLETE'),'incomplete profile cannot list');
select pg_temp.assert(pg_temp.raises($$select public.upsert_looking_listing('00000000-0000-0000-0000-000000000005',array[repeat('x',31)],'{}','hi',null,null)$$,'INVALID_INPUT'),'skill too long');
select pg_temp.assert(pg_temp.raises($$select public.upsert_looking_listing('00000000-0000-0000-0000-000000000005',array['a','b','c','d','e','f','g','h','i','j','k'],'{}','hi',null,null)$$,'INVALID_INPUT'),'too many skills');
select pg_temp.assert(pg_temp.raises($$select public.upsert_looking_listing('00000000-0000-0000-0000-000000000005',array['sql'],'{}','hi',null,'http://insecure.example')$$,'INVALID_INPUT'),'portfolio must be https');
select public.upsert_looking_listing('00000000-0000-0000-0000-000000000005',array[' SQL ','sql','React',''],array['AI'],'  Hello  ','Backend','https://example.com/me');
select public.upsert_looking_listing('00000000-0000-0000-0000-000000000005',array[' SQL ','sql','React',''],array['AI'],'  Hello  ','Backend','https://example.com/me');
select pg_temp.assert((select count(*) from public.looking_for_team)=1,'no duplicate listings');
select pg_temp.assert((select skills from public.looking_for_team)=array['SQL','React'],'skills cleaned and de-duplicated');
select pg_temp.assert((select intro from public.looking_for_team)='Hello','intro trimmed');
select public.upsert_looking_listing('00000000-0000-0000-0000-000000000006',array['Design'],'{}','',null,null);
select public.upsert_looking_listing('00000000-0000-0000-0000-000000000007',array['Go'],'{}','',null,null);

-- Invitations ---------------------------------------------------------------------
select pg_temp.assert(pg_temp.raises($$select public.send_team_invitation('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000006')$$,'NOT_LEADER'),'non-leader cannot invite');
select pg_temp.assert(pg_temp.raises($$select public.send_team_invitation('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000008')$$,'INVALID_INPUT'),'cannot invite yourself');
select pg_temp.assert(pg_temp.raises($$select public.send_team_invitation('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000010')$$,'TARGET_NOT_LOOKING'),'target must have a listing');
select pg_temp.assert(pg_temp.raises($$select public.send_team_invitation('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000002')$$,'TARGET_UNAVAILABLE'),'target already in a team');
select pg_temp.assert(pg_temp.raises($$select public.send_team_invitation('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000005')$$,'TEAM_FULL'),'full team cannot invite');

select public.send_team_invitation('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000005');
select pg_temp.assert(pg_temp.raises($$select public.send_team_invitation('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000005')$$,'DUPLICATE_REQUEST'),'no duplicate invitation');
select pg_temp.assert(pg_temp.raises($$select public.request_to_join('00000000-0000-0000-0000-000000000005','aaaaaaaa-0000-0000-0000-000000000008')$$,'DUPLICATE_REQUEST'),'no request while an invitation is pending');
select pg_temp.assert(pg_temp.raises($$select public.cancel_team_request('00000000-0000-0000-0000-000000000005',(select id from public.team_requests where direction='invitation' and status='pending'))$$,'REQUEST_NOT_FOUND'),'invitee cannot cancel the team''s invitation');
select pg_temp.assert(pg_temp.raises($$select public.respond_to_team_request('00000000-0000-0000-0000-000000000008',(select id from public.team_requests where direction='invitation' and status='pending'),true)$$,'REQUEST_NOT_FOUND'),'leader cannot accept on the invitee''s behalf');
select pg_temp.assert(pg_temp.raises($$select public.respond_to_team_request('00000000-0000-0000-0000-000000000006',(select id from public.team_requests where direction='invitation' and status='pending'),true)$$,'REQUEST_NOT_FOUND'),'someone else cannot accept');
select public.cancel_team_request('00000000-0000-0000-0000-000000000008',(select id from public.team_requests where direction='invitation' and status='pending'));
select public.send_team_invitation('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000005');
select public.respond_to_team_request('00000000-0000-0000-0000-000000000005',(select id from public.team_requests where direction='invitation' and status='pending'),false);
select pg_temp.assert(exists (select 1 from public.team_requests where direction='invitation' and user_id='00000000-0000-0000-0000-000000000005' and status='rejected'),'invitee can reject');
select public.send_team_invitation('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000005');

-- u5 is also invited by TeamD; accepting TeamC must cancel the other offer
select public.send_team_invitation('00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000005');
select public.respond_to_team_request('00000000-0000-0000-0000-000000000005',(select id from public.team_requests where direction='invitation' and status='pending' and team_id='aaaaaaaa-0000-0000-0000-000000000008'),true);
select pg_temp.assert((select team_id from public.team_members where user_id='00000000-0000-0000-0000-000000000005')='aaaaaaaa-0000-0000-0000-000000000008','accepted invitation adds the member');
select pg_temp.assert(not exists (select 1 from public.looking_for_team where user_id='00000000-0000-0000-0000-000000000005'),'listing removed once on a team');
select pg_temp.assert((select status from public.team_requests where team_id='aaaaaaaa-0000-0000-0000-000000000009' and user_id='00000000-0000-0000-0000-000000000005')='cancelled','competing invitation cancelled');
select pg_temp.assert(pg_temp.raises($$select public.respond_to_team_request('00000000-0000-0000-0000-000000000005',(select id from public.team_requests where team_id='aaaaaaaa-0000-0000-0000-000000000009' and user_id='00000000-0000-0000-0000-000000000005'),true)$$,'REQUEST_NOT_PENDING'),'cancelled invitation cannot be accepted');

-- Joining by invite link also clears listing and open requests
select public.request_to_join('00000000-0000-0000-0000-000000000006','aaaaaaaa-0000-0000-0000-000000000009');
select public.join_team('00000000-0000-0000-0000-000000000006','hd');
select pg_temp.assert(not exists (select 1 from public.looking_for_team where user_id='00000000-0000-0000-0000-000000000006'),'link join removes listing');
select pg_temp.assert(not exists (select 1 from public.team_requests where user_id='00000000-0000-0000-0000-000000000006' and status='pending'),'link join closes open requests');

-- Withdraw and dissolve
select public.withdraw_looking_listing('00000000-0000-0000-0000-000000000007');
select pg_temp.assert(not exists (select 1 from public.looking_for_team),'withdraw removes the listing');
select public.upsert_looking_listing('00000000-0000-0000-0000-000000000007',array['Go'],'{}','',null,null);
select public.send_team_invitation('00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000007');
select public.dissolve_team('00000000-0000-0000-0000-000000000009','aaaaaaaa-0000-0000-0000-000000000009');
select pg_temp.assert(not exists (select 1 from public.team_requests where team_id='aaaaaaaa-0000-0000-0000-000000000009'),'dissolving a team removes its requests');

-- Browser access -------------------------------------------------------------------
reset role; set local role authenticated;
select pg_temp.assert(pg_temp.raises($$select * from public.team_requests$$,'permission denied'),'requests not readable directly');
select pg_temp.assert(pg_temp.raises($$select * from public.looking_for_team$$,'permission denied'),'listings not readable directly');
select pg_temp.assert(pg_temp.raises($$insert into public.team_requests (team_id,user_id,direction) values ('aaaaaaaa-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000007','request')$$,'permission denied'),'no direct request insert');
select pg_temp.assert(pg_temp.raises($$update public.team_requests set status='accepted'$$,'permission denied'),'no direct status edit');
select pg_temp.assert(pg_temp.raises($$insert into public.team_members (team_id,user_id) values ('aaaaaaaa-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000007')$$,'permission denied'),'no direct membership insert');
select pg_temp.assert(pg_temp.raises($$select public.respond_to_team_request('00000000-0000-0000-0000-000000000003',gen_random_uuid(),true)$$,'permission denied'),'write RPCs not callable by browsers');
select pg_temp.assert(pg_temp.raises($$select public.request_to_join('00000000-0000-0000-0000-000000000007','aaaaaaaa-0000-0000-0000-000000000003')$$,'permission denied'),'request_to_join not callable by browsers');

-- u7 (listed, no team): browses
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000007',true);
select pg_temp.assert((public.browse_teams()->>'total')::int=3,'browse shows every team');
select pg_temp.assert((public.browse_teams('teamc')->>'total')::int=1,'team name search');
select pg_temp.assert((public.browse_teams(null,true)->>'total')::int=1,'only open teams (TeamC has a slot)');
select pg_temp.assert(public.browse_teams()::text !~ '(mobile|gmail|invite|token|leader_id|@)','team browse leaks nothing private');
select pg_temp.assert((public.browse_seekers()->>'total')::int=1,'seekers lists active listings');
-- LinkedIn is deliberately shared with other participants so they can get in touch (see
-- notifications_kick_linkedin migration); phone numbers and emails still never are.
select pg_temp.assert(public.browse_seekers()::text !~ '(mobile|gmail|@)','seeker browse leaks no phone or email');
select pg_temp.assert(public.browse_seekers()::text ~ 'https://www\.linkedin\.com/in/user[0-9]+','seeker browse includes the LinkedIn profile link');
select pg_temp.assert((public.browse_seekers(null,'go')->>'total')::int=1,'skill filter');
select pg_temp.assert((public.browse_seekers(null,'rust')->>'total')::int=0,'skill filter excludes others');
select pg_temp.assert((public.my_matching_state()->'listing'->'skills')::text='["Go"]','my state has my listing');
select pg_temp.assert(jsonb_array_length(public.my_matching_state()->'received_invitations')=0,'invitation from a dissolved team is gone');

-- A leader sees requests for their own team only
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000008',true);
select pg_temp.assert((public.my_matching_state()->'team'->>'is_leader')::boolean,'leader flagged');
select pg_temp.assert(jsonb_array_length(public.my_matching_state()->'sent_invitations')>=1,'leader sees invitations sent');
select pg_temp.assert(public.my_matching_state()->'incoming_requests' is not null,'leader sees incoming requests');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000005',true);
select pg_temp.assert((public.my_matching_state()->'incoming_requests') is null or jsonb_typeof(public.my_matching_state()->'incoming_requests')='null','members do not see leader sections');

-- Incomplete profiles get nothing
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
select pg_temp.assert((public.browse_teams()->>'total')::int=0,'incomplete profile cannot browse teams');
select pg_temp.assert((public.browse_seekers()->>'total')::int=0,'incomplete profile cannot browse seekers');
-- Signed out
select set_config('request.jwt.claim.sub','',true);
select pg_temp.assert((public.browse_teams()->>'total')::int=0,'signed-out gets nothing');
select pg_temp.assert(public.my_matching_state() is null,'signed-out has no state');
reset role;

select 'ALL MATCHING CHECKS PASSED' as result;
rollback;
