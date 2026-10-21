// Central event configuration. Fields set to null are shown as "To be announced"
// until the organizers provide the real values. Do not invent details here.
export const eventConfig = {
  name: "Hacktoberfest Kashmir",
  tagline: "Open source, built together.",
  description:
    "A community event for developers in Kashmir to learn, collaborate and contribute to open source in teams.",
  date: null as string | null,
  venue: null as string | null,
  registrationDeadline: null as string | null,
  contactEmail: null as string | null,
  socials: {
    github: null as string | null,
    instagram: null as string | null,
  },
  team: {
    // Keep in sync with the default in supabase/migrations (teams.max_members).
    maxMembers: 4,
    minDescriptionLength: 10,
    maxDescriptionLength: 300,
    minNameLength: 3,
    maxNameLength: 40,
  },
  appUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export const TBA = "To be announced";
