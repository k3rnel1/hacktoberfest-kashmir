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
    linkedin: "https://www.linkedin.com/in/ali-zubair-shah-5640033a1" as string | null,

  },
  team: {
    maxMembers: 3,
    minDescriptionLength: 10,
    maxDescriptionLength: 300,
    minNameLength: 3,
    maxNameLength: 40,
  },
  appUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
} as const;

export const TBA = "To be announced";