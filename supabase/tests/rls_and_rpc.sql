-- Repeatable database checks. Run against a database with the migrations applied.
-- Aborts with an exception on the first failed assertion. Cleans up after itself.
begin;

create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as
$$ begin if cond is not true then raise exception 'FAIL: %', msg; end if; end $$;

create function pg_temp.raises(sql text, code text) returns boolean language plpgsql as
$$ begin execute sql; return false;
   exception when others then return sqlerrm = code or sqlerrm like code || '%'; end $$;

-- Users (the trigger creates profiles)
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','a@x.invalid','{"username":"alice"}'),
 ('00000000-0000-0000-0000-00000000000b','b@x.invalid','{"username":"bob"}'),
 ('00000000-0000-0000-0000-00000000000c','c@x.invalid','{"username":"carol"}'),
 ('00000000-0000-0000-0000-00000000000d','d@x.invalid','{"username":"dave"}');

select pg_temp.assert(pg_temp.raises(
  $$insert into auth.users (email, raw_user_meta_data) values ('z@x.invalid','{"username":"ALICE"}')$$,
  'duplicate key'), 'usernames unique case-insensitively');

update public.profiles set full_name='Alice A', mobile_number='+919876543210', gmail='alice@gmail.com',
  github_username='alice', linkedin_url='https://www.linkedin.com/in/alice' where username in ('alice','bob','carol');
select pg_temp.assert((select profile_completed from public.profiles where username='alice'), 'profile completes');
select pg_temp.assert(not (select profile_completed from public.profiles where username='dave'), 'dave incomplete');

grant all on all tables in schema public to service_role;  -- no-op if already granted

-- RPCs run as service_role
set local role service_role;
select pg_temp.assert(pg_temp.raises($$select public.create_team('00000000-0000-0000-0000-00000000000d', gen_random_uuid(), 'Team D','long enough desc','h0',4,null)$$,'PROFILE_INCOMPLETE'),'incomplete profile cannot create');
select public.create_team('00000000-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','Team One','A description here','hash1',2,null);
select pg_temp.assert((select count(*) from public.team_members where role='leader')=1,'leader membership created atomically');
select pg_temp.assert(pg_temp.raises($$select public.create_team('00000000-0000-0000-0000-00000000000a', gen_random_uuid(), 'Other','A description here','hash9',4,null)$$,'ALREADY_IN_TEAM'),'cannot create second team');
select pg_temp.assert(pg_temp.raises($$select public.create_team('00000000-0000-0000-0000-00000000000b', gen_random_uuid(), ' team one ','A description here','hash8',4,null)$$,'INVALID_INPUT') or pg_temp.raises($$select public.create_team('00000000-0000-0000-0000-00000000000b', gen_random_uuid(), 'TEAM ONE','A description here','hash8',4,null)$$,'TEAM_NAME_TAKEN'),'team name unique ignoring case');
select pg_temp.assert((select count(*) from public.teams)=1,'failed create leaves no partial team');

select pg_temp.assert(pg_temp.raises($$select public.join_team('00000000-0000-0000-0000-00000000000b','nope')$$,'INVITE_INVALID'),'bad token');
select public.join_team('00000000-0000-0000-0000-00000000000b','hash1');
select pg_temp.assert(pg_temp.raises($$select public.join_team('00000000-0000-0000-0000-00000000000b','hash1')$$,'ALREADY_MEMBER'),'no duplicate membership');
select pg_temp.assert(pg_temp.raises($$select public.join_team('00000000-0000-0000-0000-00000000000c','hash1')$$,'TEAM_FULL'),'capacity enforced');
select pg_temp.assert(pg_temp.raises($$select public.leave_team('00000000-0000-0000-0000-00000000000a')$$,'LEADER_CANNOT_LEAVE'),'leader cannot leave');

select public.revoke_invite('00000000-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111');
select pg_temp.assert(pg_temp.raises($$select public.join_team('00000000-0000-0000-0000-00000000000c','hash1')$$,'INVITE_REVOKED'),'revoked');
select pg_temp.assert(pg_temp.raises($$select public.revoke_invite('00000000-0000-0000-0000-00000000000b','11111111-1111-1111-1111-111111111111')$$,'NOT_LEADER'),'member cannot revoke');
select pg_temp.assert(pg_temp.raises($$select public.rotate_invite('00000000-0000-0000-0000-00000000000b','11111111-1111-1111-1111-111111111111',1,'h2',null)$$,'NOT_LEADER'),'member cannot rotate');
select public.rotate_invite('00000000-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111',1,'hash2',null);
select pg_temp.assert(pg_temp.raises($$select public.join_team('00000000-0000-0000-0000-00000000000c','hash1')$$,'INVITE_INVALID'),'old link dead after rotate');

select public.transfer_leadership('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select leader_id from public.teams)='00000000-0000-0000-0000-00000000000b','leadership moved');
select public.leave_team('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.team_members)=1,'member left');

-- anon/authenticated cannot call privileged functions
reset role; set local role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.join_team('00000000-0000-0000-0000-00000000000c','hash2')$$,'permission denied'),'authenticated cannot call join_team');
select pg_temp.assert(pg_temp.raises($$select public.admin_stats()$$,'permission denied'),'authenticated cannot call admin_stats');
select pg_temp.assert(pg_temp.raises($$select * from public.admin_users$$,'permission denied'),'authenticated cannot read admin_users');
select pg_temp.assert(pg_temp.raises($$select * from public.admin_audit_logs$$,'permission denied'),'authenticated cannot read audit log');
select pg_temp.assert(pg_temp.raises($$select invite_token_hash from public.teams$$,'permission denied'),'invite hash unreadable');
select pg_temp.assert(pg_temp.raises($$insert into public.teams (name,description,leader_id,invite_token_hash) values ('x','y','00000000-0000-0000-0000-00000000000c','h')$$,'permission denied'),'no direct team insert');
select pg_temp.assert(pg_temp.raises($$insert into public.team_members (team_id,user_id) values ('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-00000000000c')$$,'permission denied'),'no direct membership insert');

-- Carol (not in team 1): sees only herself, no team, no other profiles
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000c',true);
select pg_temp.assert((select count(*) from public.profiles)=1,'user sees only own profile');
select pg_temp.assert((select count(*) from public.teams)=0,'non-member sees no teams');
select pg_temp.assert((select count(*) from public.team_members)=0,'non-member sees no memberships');
select pg_temp.assert(public.team_detail_for_member('11111111-1111-1111-1111-111111111111') is null,'non-member gets no team detail');
update public.profiles set full_name='Hacked' where username='bob';
select pg_temp.assert(pg_temp.raises($$update public.profiles set username='mallory' where id='00000000-0000-0000-0000-00000000000c'$$,'permission denied'),'username not editable');
select pg_temp.assert(pg_temp.raises($$update public.profiles set must_change_password=false where id='00000000-0000-0000-0000-00000000000c'$$,'permission denied'),'flags not editable');

-- Bob (member): sees his team, detail has no phone/email
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',true);
select pg_temp.assert((select count(*) from public.teams)=1,'member sees own team');
select pg_temp.assert(public.team_detail_for_member('11111111-1111-1111-1111-111111111111')::text !~ '(mobile|gmail|@gmail)','team detail leaks no contact data');
select pg_temp.assert(public.invite_preview('hash2')->>'status'='ok','invite preview ok');

reset role;
select pg_temp.assert((select full_name from public.profiles where username='bob')='Alice A','other user update blocked by RLS');

-- Admin stats exclude admins
insert into auth.users (id,email,raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000ff','admin@x.invalid','{"username":"root_admin"}');
insert into public.admin_users values ('00000000-0000-0000-0000-0000000000ff');
set local role service_role;
select pg_temp.assert((public.admin_stats()->>'total_users')::int=4,'admin excluded from stats');
select pg_temp.assert((select count(*) from public.admin_list_users(null,'all','all','all','created_at','desc',25,0))=4,'admin excluded from list');
select pg_temp.assert((select count(*) from public.admin_list_users('bo%x','all','all','all','created_at','desc',25,0))=0,'wildcards escaped in search');
select pg_temp.assert((select count(*) from public.admin_list_users('bob','in_team','leader','complete','team_name','asc',25,0))=1,'filters + search');
select pg_temp.assert(pg_temp.raises($$select public.admin_remove_member('00000000-0000-0000-0000-0000000000ff','00000000-0000-0000-0000-00000000000b')$$,'REMOVE_LEADER_BLOCKED'),'cannot remove leader');
select public.admin_dissolve_team('00000000-0000-0000-0000-0000000000ff','11111111-1111-1111-1111-111111111111');
select pg_temp.assert((select count(*) from public.teams)=0,'dissolved');
select pg_temp.assert((select count(*) from public.admin_audit_logs)=1,'audit entries written');

-- Team selection status --------------------------------------------------------
select public.create_team('00000000-0000-0000-0000-00000000000b','22222222-2222-2222-2222-222222222222','Team Two','A description here','hash3',4,null);
select pg_temp.assert((select selection_status from public.teams)='in_process','new teams default to in_process');
select pg_temp.assert((select selection_status_updated_at is null from public.teams),'no status metadata before first change');
select pg_temp.assert(pg_temp.raises($$select public.admin_set_team_status('00000000-0000-0000-0000-0000000000ff','22222222-2222-2222-2222-222222222222','maybe')$$,'INVALID_STATUS'),'invalid status rejected');
select pg_temp.assert(pg_temp.raises($$select public.admin_set_team_status('00000000-0000-0000-0000-0000000000ff','99999999-9999-9999-9999-999999999999','selected')$$,'TEAM_NOT_FOUND'),'unknown team rejected');
select pg_temp.assert(pg_temp.raises($$update public.teams set selection_status='bogus'$$,'new row for relation'),'check constraint blocks bad values');
select public.admin_set_team_status('00000000-0000-0000-0000-0000000000ff','22222222-2222-2222-2222-222222222222','selected');
select pg_temp.assert((select selection_status='selected' and selection_status_updated_by='00000000-0000-0000-0000-0000000000ff' and selection_status_updated_at is not null from public.teams),'status + metadata recorded');
select pg_temp.assert((select count(*) from public.admin_audit_logs where action='set_team_status' and metadata=jsonb_build_object('from','in_process','to','selected'))=1,'status change audited');
select public.admin_set_team_status('00000000-0000-0000-0000-0000000000ff','22222222-2222-2222-2222-222222222222','selected');
select pg_temp.assert((select count(*) from public.admin_audit_logs where action='set_team_status')=1,'unchanged status is not re-audited');
select pg_temp.assert((select count(*) from public.admin_list_teams(null,'created_at','desc',25,0,'selected'))=1,'team list status filter');
select pg_temp.assert((select count(*) from public.admin_list_teams(null,'created_at','desc',25,0,'rejected'))=0,'team list status filter excludes others');
select pg_temp.assert((select selection_status_updated_by from public.admin_list_users('bob','all','all','all','created_at','desc',25,0))='root_admin','participant export rows carry status metadata');
select pg_temp.assert(public.admin_team_detail('22222222-2222-2222-2222-222222222222')->>'selection_status'='selected','admin detail has status');

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000b',true);
select pg_temp.assert(public.team_detail_for_member('22222222-2222-2222-2222-222222222222')->>'selection_status'='selected','member sees own team status');
select pg_temp.assert(public.team_detail_for_member('22222222-2222-2222-2222-222222222222')::text !~ 'updated_by','participants do not see who changed the status');
select pg_temp.assert(pg_temp.raises($$update public.teams set selection_status='selected'$$,'permission denied'),'members cannot write status');
select pg_temp.assert(pg_temp.raises($$select selection_status from public.teams$$,'permission denied'),'status column not directly readable');
select pg_temp.assert(pg_temp.raises($$select public.admin_set_team_status('00000000-0000-0000-0000-00000000000b','22222222-2222-2222-2222-222222222222','selected')$$,'permission denied'),'authenticated cannot call admin_set_team_status');
reset role;

-- Finalists and awards ------------------------------------------------------------
select pg_temp.assert((select not is_finalist and award is null from public.teams),'teams are not finalists by default');
select pg_temp.assert(public.public_finalists()='[]'::jsonb,'no finalists yet');
update public.teams set selection_status='in_process';
select pg_temp.assert(pg_temp.raises($$select public.admin_set_team_finalist('00000000-0000-0000-0000-0000000000ff','22222222-2222-2222-2222-222222222222',true,'Winner',1)$$,'NOT_SELECTED'),'only selected teams can be finalists');
update public.teams set selection_status='selected';
select pg_temp.assert(pg_temp.raises($$select public.admin_set_team_finalist('00000000-0000-0000-0000-0000000000ff','99999999-9999-9999-9999-999999999999',true,null,null)$$,'TEAM_NOT_FOUND'),'finalist: unknown team');
select pg_temp.assert(pg_temp.raises($$select public.admin_set_team_finalist('00000000-0000-0000-0000-0000000000ff','22222222-2222-2222-2222-222222222222',true,'x',null)$$,'INVALID_INPUT'),'award too short');
select pg_temp.assert(pg_temp.raises($$select public.admin_set_team_finalist('00000000-0000-0000-0000-0000000000ff','22222222-2222-2222-2222-222222222222',true,null,3)$$,'INVALID_INPUT'),'rank needs an award');
select pg_temp.assert(pg_temp.raises($$select public.admin_set_team_finalist('00000000-0000-0000-0000-0000000000ff','22222222-2222-2222-2222-222222222222',true,'Winner',100)$$,'INVALID_INPUT'),'rank out of range');
select public.admin_set_team_finalist('00000000-0000-0000-0000-0000000000ff','22222222-2222-2222-2222-222222222222',true,null,null);
select pg_temp.assert(jsonb_array_length(public.public_finalists())=1,'finalist listed');
select public.admin_set_team_finalist('00000000-0000-0000-0000-0000000000ff','22222222-2222-2222-2222-222222222222',true,'  Winner ',1);
select pg_temp.assert((select award='Winner' and award_rank=1 from public.teams),'award saved and trimmed');
select pg_temp.assert(public.public_finalists()->0->>'award'='Winner','public data has award');
select pg_temp.assert(public.public_finalists()::text !~ '(mobile|gmail|@gmail|github|linkedin|leader_id|"id")','public finalists leak nothing private');
select pg_temp.assert((select count(*) from public.admin_audit_logs where action='set_team_finalist')=2,'finalist changes audited');
select pg_temp.assert((select is_finalist and award='Winner' from public.admin_list_teams(null,'created_at','desc',25,0,'all')),'admin list carries finalist fields');
select pg_temp.assert((public.admin_team_detail('22222222-2222-2222-2222-222222222222')->>'award')='Winner','admin detail carries award');
select pg_temp.assert(pg_temp.raises($$update public.teams set is_finalist=false, award='X!'$$,'new row for relation'),'constraint: award needs finalist');
select public.admin_set_team_finalist('00000000-0000-0000-0000-0000000000ff','22222222-2222-2222-2222-222222222222',false,'Winner',1);
select pg_temp.assert((select not is_finalist and award is null and award_rank is null from public.teams),'removing finalist clears the award');

reset role; set local role authenticated;
select pg_temp.assert(pg_temp.raises($$select public.public_finalists()$$,'permission denied'),'browsers cannot call public_finalists directly');
select pg_temp.assert(pg_temp.raises($$select public.admin_set_team_finalist('00000000-0000-0000-0000-00000000000b','22222222-2222-2222-2222-222222222222',true,null,null)$$,'permission denied'),'authenticated cannot set finalists');
select pg_temp.assert(pg_temp.raises($$select is_finalist from public.teams$$,'permission denied'),'finalist columns not directly readable');
reset role;

select 'ALL DB CHECKS PASSED' as result;
rollback;
