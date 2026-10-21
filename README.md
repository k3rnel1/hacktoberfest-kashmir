# Hacktoberfest Kashmir: registration & team platform

Next.js (App Router) + TypeScript + Tailwind + Supabase (Auth, Postgres, RLS), deployable on Vercel.

Participants register with a **username + password**, complete a profile, then create a team or join one through a private invitation link. Organizers manage everything from `/admin`.

## How it works

| Concern | Design |
|---|---|
| Username login | Supabase Auth needs an email, so each account gets an internal address `<username>@users.hacktoberfest-kashmir.invalid` derived on the server. Users never see it. Login computes it server-side and calls `signInWithPassword`; there is no lookup endpoint, so no username or email list is exposed. Wrong username and wrong password return the same message. |
| Passwords | Handled only by Supabase Auth. No password or hash is stored in app tables. |
| Identity vs. data | `auth.users` holds identity. `profiles` (keyed by the immutable user id) holds event data. A trigger creates the profile in the same transaction as the account. |
| Team changes | Create, join, leave, transfer, dissolve and invite rotation are Postgres functions running in one transaction. Joins lock the team row, so capacity can't be raced. `team_members.user_id` is unique: one team per person. |
| Invitations | Token = `HMAC(INVITE_TOKEN_SECRET, teamId:version)`. Only its SHA-256 hash is stored, and `invite_token_hash` is not readable through the API. Regenerating bumps the version, which kills old links. Leaders can revoke. |
| Privacy | Teammates see name, GitHub and LinkedIn only. Phone and Gmail are visible to admins only. Non-members get a 404 for team pages. |
| Admin | A dedicated Auth account listed in `admin_users` (no access to anon/authenticated roles). Every admin page, action and the CSV route re-check this on the server. The first login forces a password change. |
| Browser access | Browsers can read only their own profile/team rows and edit five profile columns. All other writes go through `service_role`-only functions that the server calls with the user id from the verified session. |
| Abuse protection | Postgres-backed rate limits (shared across serverless instances) on register, login, admin login, join, create-team, invite rotation and password change. Fails closed. |
| CSV | Cells starting with `= + - @ tab CR` are prefixed with `'`. Exports are audit-logged. |

## Setup

### 1. Supabase project
1. Create a project at supabase.com.
2. **Authentication → Providers → Email**: keep Email enabled and turn **off "Confirm email"** (users have no real inbox). Public sign-ups can stay on, but the app only creates accounts through its own server action.
3. Run the migrations in order (SQL Editor, or `supabase db push` with the CLI):
   - `supabase/migrations/20261020000001_schema.sql`
   - `supabase/migrations/20261020000002_functions.sql`
   - `supabase/migrations/20261020000003_rls.sql`
4. **Project Settings → API**: copy the URL, anon/publishable key and service-role/secret key.

> Supabase Auth also exposes its own public sign-up API. Because internal emails end in `.invalid`, anyone calling it directly gets an account without the app's username rules or rate limit. To block this, disable **"Allow new users to sign up"** in Auth settings; the app creates users with the service-role key and does not need it.

### 2. Local development
```bash
npm install
cp .env.example .env.local        # fill in the values
openssl rand -base64 48           # use as INVITE_TOKEN_SECRET
npm run dev                       # http://localhost:3000
```

### 3. First administrator
Set `ADMIN_USERNAME` and `ADMIN_INITIAL_PASSWORD` in `.env.local` (choose your own initial password and do not commit it), then:
```bash
npm run admin:bootstrap
```
Sign in at `/admin/login`. You are forced to choose a new password (10+ characters, letters and numbers) before the panel opens. Afterwards remove `ADMIN_INITIAL_PASSWORD` from your environment. The script refuses to promote an existing participant and is safe to re-run.

The app never depends on default credentials. If Supabase's minimum password length is above your initial password length, lower it or pick a longer initial password.

### 4. Deploy to Vercel
1. Import the repository into Vercel (framework: Next.js).
2. Add environment variables from `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INVITE_TOKEN_SECRET`, `NEXT_PUBLIC_SITE_URL` (your production URL). Mark the service-role key and invite secret as sensitive. Do **not** add the admin password to Vercel; run the bootstrap locally against the production project instead.
3. Deploy.

### Event details
Edit `src/config/event.ts`: date, venue, deadline, contact email and team size. Anything left `null` shows "To be announced". Keep `team.maxMembers` in sync with the `max_members` default in the schema if you change it; new teams take the value from the config.

## Verification

```bash
npm run typecheck && npm run test:unit && npm run build
```

**Database checks** (need any Postgres 15+ with the migrations applied; the Supabase roles and `auth` schema must exist, as on a Supabase project):
```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_and_rpc.sql      # RLS, privileges, one-team rule, capacity, admin functions
PSQL="psql $DB_URL" bash supabase/tests/concurrency.sh                   # concurrent joins
```
Run these against a scratch database, not production: they create and delete test users and teams.

**Manual end-to-end checklist** (against your Supabase project):
1. Register `alice` → complete profile → dashboard shows progress 2/3.
2. Create a team → redirected to `/team/<id>` with a copyable invite link.
3. In a private window open the link → redirected to login/register → after profile completion you return to the invite page → **Join team**.
4. Both users see the same member list (names, GitHub, LinkedIn only).
5. As the second user open another team's link → "already belong to a team".
6. Fill the team (default 4) → the next user sees "team is full". Revoke or regenerate the link → old link shows invalid/revoked.
7. As a normal user visit `/admin` → redirected to `/admin/login`; `/admin/users/export` returns 403/redirect.
8. As admin: view overview, search/sort/filter, export CSV, remove a member, revoke an invite, dissolve a team (all confirm first), check `/admin/audit`.
9. Open the site at a phone width (~375px) and on desktop.

**Checking RLS yourself:** in the Supabase SQL editor, `set local role authenticated; select set_config('request.jwt.claim.sub','<user-uuid>',true);` then `select * from profiles;` returns only that user's row, and `select * from admin_users;` fails with permission denied.

## Project layout
```
src/app/(site)/      public + participant pages
src/app/admin/       admin login + (panel) protected pages and CSV route
src/actions/         server actions (auth, profile, teams, admin)
src/lib/             supabase clients, auth guards, validation, invite tokens, rate limit, csv
src/proxy.ts         session refresh + redirects (convenience only; pages re-check)
supabase/migrations  schema, functions, RLS
supabase/tests       database and concurrency checks
```

## Known limits
- Password recovery is organizer-assisted (admin → Participants → *Reset password* issues a one-time temporary password), because accounts have no real email.
- Rate limiting keys on the first `x-forwarded-for` address, which is trustworthy behind Vercel but not behind arbitrary proxies.
- The Gmail field is validated by format only; ownership is not verified.
