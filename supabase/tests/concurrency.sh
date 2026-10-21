#!/usr/bin/env bash
# Fires concurrent joins from separate connections and checks the invariants.
# Usage: PSQL="psql -h 127.0.0.1 -p 54329 -U postgres -d hk" bash supabase/tests/concurrency.sh
set -euo pipefail
: "${PSQL:?set PSQL to a psql command line for a database with the migrations applied}"
Q="$PSQL -v ON_ERROR_STOP=1 -q -At"

$Q <<'SQL'
delete from public.teams; delete from auth.users where email like 'cc%@x.invalid';
insert into auth.users (id,email,raw_user_meta_data)
  select ('20000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid, 'cc'||i||'@x.invalid', jsonb_build_object('username','cc'||i)
  from generate_series(1,16) i;
update public.profiles set full_name='Test User', mobile_number='+919876543210', gmail='t@gmail.com',
  github_username='tester', linkedin_url='https://www.linkedin.com/in/tester' where username like 'cc%';
set role service_role;
select public.create_team('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Race A','Capacity test team','hA',4,null);
select public.create_team('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','Race B','Capacity test team','hB',4,null);
SQL

# 12 users (3..14) race for the 3 free seats in team A.
for i in $(seq 3 14); do
  ( $Q -c "set role service_role; select public.join_team('20000000-0000-0000-0000-$(printf %012d $i)','hA')" >/dev/null 2>&1 || true ) &
done
# User 15 tries to join BOTH teams at the same moment, 6 times each.
for n in 1 2 3 4 5 6; do
  ( $Q -c "set role service_role; select public.join_team('20000000-0000-0000-0000-000000000015','hA')" >/dev/null 2>&1 || true ) &
  ( $Q -c "set role service_role; select public.join_team('20000000-0000-0000-0000-000000000015','hB')" >/dev/null 2>&1 || true ) &
done
wait

A=$($Q -c "select count(*) from public.team_members where team_id='30000000-0000-0000-0000-000000000001'")
DUP=$($Q -c "select count(*) from (select user_id from public.team_members group by user_id having count(*)>1) d")
B=$($Q -c "select count(*) from public.team_members where team_id='30000000-0000-0000-0000-000000000002'")
echo "team A members: $A (max 4) | team B members: $B (max 4) | users in >1 team: $DUP"
[ "$A" -le 4 ] && [ "$B" -le 4 ] && [ "$DUP" -eq 0 ] && echo "CONCURRENCY CHECK PASSED" || { echo "CONCURRENCY CHECK FAILED"; exit 1; }
$Q -c "delete from public.teams; delete from auth.users where email like 'cc%@x.invalid'" >/dev/null
