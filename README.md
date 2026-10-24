# Hacktoberfest Kashmir 

**An event platform for participants, teams, and organizers — built for Hacktoberfest Kashmir.**

Hacktoberfest Kashmir brings developers together to explore open source, collaborate with other participants, and turn ideas into working projects. This repository contains the web platform supporting participant registration workflows, team formation, and administrative team evaluation.

---

## Overview

The platform is designed to make managing a collaborative hackathon easier for both participants and organizers. Participants can find teammates, discover existing teams, manage invitations, and coordinate their team formation. Organizers can review teams through a structured shortlisting workflow.

Rather than handling team formation through disconnected messages and spreadsheets, the platform brings these workflows into one place.

## Features

### 👥 Team Management

A dedicated Teams section provides the core workflows for team formation.

- **Browse Teams** — Explore existing teams and find one to join.
- **Looking for Teams** — Register as a participant searching for a team and make your availability discoverable to team leaders.
- **Join Requests** — Send requests to join teams and manage incoming requests as a team leader.
- **Invitations** — Receive and manage invitations from team leaders and other participants through the platform.
- **Invite Links** — Share team invitation links to help prospective members find their way into a team.
- **Team Management** — Team leaders can recruit members, manage their team, or dissolve it when they decide to pursue another team.

Teams without the required members may receive lower priority during shortlisting, so participants are encouraged to complete their teams.

### 🏆 Team Shortlisting

The platform supports a structured review process for evaluating registered teams.

The evaluation workflow covers:

- Team identification and review
- Team leader's LinkedIn profile
- Team leader's GitHub profile
- Members' portfolios
- Evaluation scores and rankings

The portfolio review separates the leader's detailed assessment from the broader assessment of team members.

**Leader portfolio review** can include:

- Profile presentation
- Technical expertise
- Certifications
- Experience

**Member portfolio review** provides a concise overview with qualitative remarks, such as *Bad, Average, Good,* or *Excellent*.

This approach helps organizers assess teams consistently and prioritize them for further consideration.

### ⭐ Finalist Management

Finalist management is integrated into the Teams workflow, keeping team discovery and finalist visibility within the same section rather than requiring a separate top-level tab.

Authorized organizers can manage which teams are marked as finalists through the administrative interface.

### 🔐 Administrative Workflows

Administrative functionality supports organizer-side review and team evaluation. Access to administrative operations should be restricted to authorized users.

The platform uses Supabase for its backend services and data management.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| [Next.js](https://nextjs.org/) | React framework and application routing |
| [React](https://react.dev/) | User interface |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe application development |
| [Tailwind CSS](https://tailwindcss.com/) | Styling and responsive layouts |
| [Supabase](https://supabase.com/) | Backend services and database |
| [Vercel](https://vercel.com/) | Deployment platform |

---

## Getting Started

Follow these steps to run the project locally.

### Prerequisites

Make sure you have installed:

- [Node.js](https://nodejs.org/) — a version compatible with the project's Next.js dependencies
- npm
- Git
- A Supabase project with the required database configuration

### 1. Clone the repository

```bash
git clone https://github.com/k3rnel1/hacktoberfest-kashmir.git
cd hacktoberfest-kashmir
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root.

Add the environment variables required by the application. For a typical Supabase client setup, these may include:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

Use the exact variable names expected by the project's Supabase client configuration. If the project uses a different key format or additional environment variables, configure those accordingly.

**Security:** Never commit `.env.local`, database passwords, or Supabase secret/service-role keys. Server-only secrets must never be exposed through `NEXT_PUBLIC_` variables.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Build for production

```bash
npm run build
```

To run the production build locally:

```bash
npm run start
```

---

## Project Structure

The repository follows a Next.js application structure.

```text
hacktoberfest-kashmir/
├── public/                 # Static assets
├── scripts/                # Utility and project scripts
├── src/                    # Application source code
├── .gitignore              # Git exclusions
├── AGENTS.md               # AI coding-agent instructions
├── eslint.config.mjs       # ESLint configuration
├── next-env.d.ts           # Next.js TypeScript definitions
├── next.config.ts          # Next.js configuration
├── package.json            # Dependencies and npm scripts
├── package-lock.json       # Dependency lockfile
├── tsconfig.json           # TypeScript configuration
└── README.md               # Project documentation
```

The exact contents of `src/` and `scripts/` may evolve as the platform develops.

---

## Database and Backend

Supabase provides the backend infrastructure used by the application.

When setting up a local environment:

1. Configure the Supabase project credentials.
2. Ensure the required database tables, relationships, and access policies are present.
3. Configure authentication and authorization according to the application's implementation.
4. Test team creation, join requests, invitations, and administrative workflows before deployment.

Keep credentials and other sensitive configuration outside version control.

If database migrations or Supabase configuration files are maintained separately, make sure the setup process documents how to apply them.

---

## Deployment

The application can be deployed to [Vercel](https://vercel.com/) or another platform compatible with Next.js.

A typical deployment workflow is:

1. Import the GitHub repository into the deployment platform.
2. Configure the required environment variables.
3. Connect the appropriate Supabase project.
4. Deploy the application.
5. Verify participant workflows, database access, and administrative permissions in the deployed environment.

Do not expose privileged backend credentials in client-side code.

---

## Development

Install the dependencies and run the development server before making changes.

```bash
npm install
npm run dev
```

Before submitting changes, run the available checks:

```bash
npm run lint
npm run build
```

Check `package.json` for the exact scripts supported by the current version of the project.

### Contribution Guidelines

Contributions that improve usability, reliability, accessibility, performance, and team-management workflows are welcome.

When contributing:

1. Create a branch for your changes.
2. Keep changes focused and easy to review.
3. Test the affected workflows locally.
4. Avoid committing environment files, generated build output, or credentials.
5. Submit a pull request with a concise description of the changes.

---

## Security

If you discover a security issue, avoid publishing credentials, personal participant information, or exploitable details in a public issue. Report the issue privately to the project maintainers.

Administrative permissions and database access policies should be enforced by the backend, not solely by hiding interface elements.

---

## License

This project is licensed under the MIT License. See the LICENSE file for details

---

