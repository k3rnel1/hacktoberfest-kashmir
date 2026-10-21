
const TBA = "To be announced";
export const eventConfig = {
  name: "Hacktoberfest Kashmir",

  tagline: "Bring your ideas. Build something real. Shape what’s next.",

  description:
    "A one-day, in-person hackathon bringing Kashmir’s developers, students, designers, and tech enthusiasts together to build with open-source AI.",

  date: "Tuesday, 27th October 2026",

  venue: "Islamia College, Hawal, Srinagar, Jammu & Kashmir",

  registrationDeadline: "Sunday, 25th October 2026",

  contactEmail: "alizubairsh@gmail.com",

  contactLabel: "Support",

  socials: {
    github: null,
    instagram: null,
  },

  team: {
    minMembers: 1,
    maxMembers: 3,
    maxTeams: 10,
    maxUsers: 300,
    minTeamSize: 3,
    maxTeamSize: 40,
  },

  appUrl:
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://hacktoberfest-kashmir.vercel.app",
};

export { TBA };



// Central event configuration. Fields set to null are shown as "To be announced"
// until the organizers provide the real values. Do not invent details here.
export const eventConfig = {
name: "Hacktoberfest Kashmir",

  tagline: "Bring your ideas. Build something real. Shape what’s next.",

  description:
  "A one-day, in-person hackathon bringing Kashmir’s developers, students, designers, and tech enthusiasts together to build with open-source AI.",

  date: "Tuesday, 27th October 2026",

  venue: "Islamia College, Hawal, Srinagar, Jammu & Kashmir",

  registrationDeadline: "Sunday, 25th October 2026",

  contactEmail: "alizubairsh@gmail.com",

  contactLabel: "Support",
  socials: {
    github: null as string | null,
    instagram: null as string | null,
  },
  team: {
    // Keep in sync with the default in supabase/migrations (teams.max_members).
    maxMembers: 3,
    minDescriptionLength: 10,
    maxDescriptionLength: 300,
    minNameLength: 3,
    maxNameLength: 40,
  },
  appUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export const TBA = "To be announced";