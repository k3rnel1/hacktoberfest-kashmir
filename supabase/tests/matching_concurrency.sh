#!/usr/bin/env bash
# Races several accepts for the last free seat of a team, from separate connections.
# Usage: PSQL="psql -h 127.0.0.1 -p 54329 -U postgres -d hk" bash supabase/tests/matching_concurrency.sh
set -euo pipefail
: "${PSQL:?set PSQL to a psql command line for a database with the migrations applied}"
Q="$PSQL -v ON_ERROR_STOP=1 -q -At"

$Q <<'SQL'
delete from public.teams where name = 'MatchRace'; delete from auth.users where email like 'mr%@x.invalid';
insert into auth.users (id,email,raw_user_meta_data)
  select ('40000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid, 'mr'||i||'@x.invalid', jsonb_build_object('username','mr'||i)
  from generate_series(1,9) i;
update public.profiles set full_name='Test User', mobile_number='+919876543210', gmail='t@gmail.com',
  github_username='tester', linkedin_url='https://www.linkedin.com/in/tester' where username like 'mr%';
set role service_role;
select public.create_team('40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','MatchRace','Capacity test team','hMR',3,null);
select public.request_to_join(('40000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid,'50000000-0000-0000-0000-000000000001') from generate_series(2,9) i;
SQL

# 8 pending requests, 2 free seats: the leader accepts all of them at once.
for id in $($Q -c "select id from public.team_requests where team_id='50000000-0000-0000-0000-000000000001'"); do
  ( $Q -c "set role service_role; select public.respond_to_team_request('40000000-0000-0000-0000-000000000001','$id',true)" >/dev/null 2>&1 || true ) &
done
wait

members=$($Q -c "select count(*) from public.team_members where team_id='50000000-0000-0000-0000-000000000001'")
accepted=$($Q -c "select count(*) from public.team_requests where team_id='50000000-0000-0000-0000-000000000001' and status='accepted'")
echo "members=$members accepted=$accepted"
[ "$members" = "3" ] && [ "$accepted" = "2" ] || { echo "FAIL: capacity breached"; exit 1; }
$Q -c "delete from public.teams where name = 'MatchRace'; delete from auth.users where email like 'mr%@x.invalid'"
echo "MATCHING CONCURRENCY CHECK PASSED"
