# Hacktoberfest Kashmir

Registration and team-management site for **Hacktoberfest Kashmir**, a one-day, in-person hackathon in Srinagar. Participants register, complete their profile, and create or join teams through private invite links. Organizers manage everything from an admin panel, including the team selection phase.

Built with Next.js (App Router), TypeScript, Tailwind CSS, Supabase (Auth + PostgreSQL + RLS) and deployed on Vercel.

## Features

**Participants**
- Username and password sign-up, profile completion (name, mobile, Gmail, GitHub, LinkedIn)
- Create a team, invite members with a private link, transfer leadership, leave or dissolve
- One team per participant, with a configurable team size limit
- Team selection status (In Process, Selected, On Hold, Rejected) on the dashboard and team page

**Admins** (`/admin`)
- Dashboard statistics, participant and team lists with search, sorting and filters
- Set a team's selection status, remove members, revoke invites, dissolve teams, reset passwords
- Participants CSV export, including selection status, when it was updated and by whom
- Audit log of every administrative action

## Team matching

The **Teams** tab (`/teams`) helps participants find each other:

- **Browse Teams**: search teams, see open positions and members, and send a request to join.
- **Looking for a Team**: list your skills and interests so team leaders can find and invite you; leaders browse the directory and send invitations.
- **Requests & Invitations**: pending, accepted, rejected and cancelled requests, with accept, decline and cancel actions. A badge in the navbar shows what is waiting for you.
- **Finalists**: finalist and winning teams (also public at `/finalists`).

Acceptance happens inside a database function that locks the team row, so a team can never exceed its size limit, and joining any team clears the participant's listing and other open requests. Contact details are never shown in these views. Matching never changes a team's selection status.

## Finalists

Admins mark a `Selected` team as a finalist and optionally give it an award (for example "Winner") from the team's admin page. The public page shows team name, description, award and member names only.

## Selection statuses

| Database value | Label |
|---|---|
| `in_process` (default) | In Process |
| `selected` | Selected |
| `on_hold` | On Hold |
| `rejected` | Rejected |

The values are enforced by a `CHECK` constraint and shared in `src/lib/selection.ts`. Status changes go through the `admin_set_team_status` database function, are audited, and can only be made server-side by an admin. Participants see only the status, never who changed it.

## Security model

- Browsers get read-only, narrowly scoped access through RLS. All writes go through `service_role`-only database functions called from server actions.
- Admin access is checked on the server for every page, action and export, using the `admin_users` table. Hiding a button is never the control.
- Invite tokens are derived with an HMAC and only their SHA-256 hash is stored.
- Rate limiting is stored in Postgres, so it works across serverless instances.
- CSV exports are protected against spreadsheet formula injection.
- The service-role key is only used on the server.

## Getting started

### Prerequisites
- Node.js 20+
- A Supabase project (or the Supabase CLI for local development)

### 1. Install

```bash
npm install
```

### 2. Environment variables

Create `.env.local`:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | Public client key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key. Never expose it to the browser |
| `INVITE_TOKEN_SECRET` | At least 32 characters. Changing it invalidates all invite links |
| `NEXT_PUBLIC_SITE_URL` | Public site URL, used to build invite links (defaults to `http://localhost:3000`) |
| `ADMIN_USERNAME`, `ADMIN_INITIAL_PASSWORD` | Used only by the admin bootstrap script |

### 3. Database

Apply the migrations in `supabase/migrations/` in order, using the Supabase CLI (`supabase db push`) or the SQL editor:

1. `20261020000001_schema.sql` – tables, constraints, triggers
2. `20261020000002_functions.sql` – team and admin database functions
3. `20261020000003_rls.sql` – Row Level Security and privileges
4. `20261022000001_team_selection_status.sql` – team selection phase
5. `20261023000001_finalists.sql` – finalists and awards
6. `20261023000002_team_matching.sql` – join requests, invitations and looking-for-team listings

Existing teams become `in_process` when the last migration is applied.

### 4. Create the first admin

```bash
npm run admin:bootstrap
```

This creates the admin user and forces a password change at first login. Sign in at `/admin/login`.

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run test:unit` | Unit checks (CSV sanitising, validation) |
| `npm run admin:bootstrap` | Create the first admin |

### Database tests

Run against a database with all migrations applied:

```bash
psql "$DATABASE_URL" -f supabase/tests/rls_and_rpc.sql      # RLS, RPCs, selection status
psql "$DATABASE_URL" -f supabase/tests/team_matching.sql     # requests, invitations, listings
PSQL="psql ..." bash supabase/tests/concurrency.sh           # concurrent-join invariants
PSQL="psql ..." bash supabase/tests/matching_concurrency.sh  # concurrent accepts for the last seat
```

The SQL test needs a Supabase-style `auth` schema (`auth.users`, `auth.uid()`) and the `anon`, `authenticated` and `service_role` roles. It rolls back after running.

## Configuration

Event details (name, date, venue, team size, contact email, social links) live in `src/config/event.ts`. Social links are shown in the footer when set. Keep `team.maxMembers` in sync with the `teams.max_members` default in the schema migration.

## Project structure

```
src/
  actions/        Server actions (auth, profile, teams, admin)
  app/
    (site)/       Participant pages: dashboard, team, join, settings
    admin/        Admin panel: teams, participants, audit log, CSV export
  components/     UI, forms, team and admin components
  config/         Event configuration
  lib/            Auth, validation, CSV, invites, rate limiting, selection statuses
  proxy.ts        Session refresh and route protection
supabase/
  migrations/     Schema, functions, RLS, selection status
  tests/          SQL and concurrency checks
scripts/          Admin bootstrap and unit checks
```

## Deployment

Deploy on Vercel and set the environment variables above for the production environment. Apply new migrations to the production database **before** deploying code that depends on them.

## License

Add a license for the project here.
