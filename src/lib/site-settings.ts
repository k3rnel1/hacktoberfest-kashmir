import { z } from "zod";
import { eventConfig } from "@/config/event";

// Organizer controls. Shared by the admin Controls page (labels, grouping) and the
// server (defaults, messages). The database enforces the same keys (see the
// site_settings migration).

export const SETTING_KEYS = [
  "registrations_open",
  "profile_editing_open",
  "team_creation_open",
  "team_joining_open",
  "team_matching_open",
  "team_changes_open",
  "selection_status_visible",
  "finalists_visible",
  "participant_login_open",
  "project_submissions_open",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export type SiteSettings = Record<SettingKey, boolean> & {
  announcement: string | null;
  // Master switch. When on, participants can only log in and read their own pages.
  lockdown: boolean;
  // ISO timestamps. Registrations close by themselves at the first, lockdown starts at the second.
  registrations_close_at: string | null;
  lockdown_at: string | null;
  // Home page "event details" overrides. null means use src/config/event.ts.
  event_date: string | null;
  event_venue: string | null;
  event_registration_deadline: string | null;
  event_venue_map_url: string | null;
  // Team size limit set by the organizers. null means the default in src/config/event.ts.
  team_max_members: number | null;
  // Website text overrides. null means the default (see branding() below).
  site_name: string | null;
  site_title: string | null;
  hero_badge: string | null;
  tagline: string | null;
  site_description: string | null;
  footer_text: string | null;
};

export const LOCKDOWN_MESSAGE =
  "Time is up. The event is closed and no more interaction is allowed on the site.";

// Everything open and visible: what the site did before these controls existed.
export const DEFAULT_SETTINGS: SiteSettings = {
  registrations_open: true,
  profile_editing_open: true,
  team_creation_open: true,
  team_joining_open: true,
  team_matching_open: true,
  team_changes_open: true,
  selection_status_visible: true,
  finalists_visible: true,
  participant_login_open: true,
  // The one switch that starts closed: the organizers open it when projects are due.
  project_submissions_open: false,
  announcement: null,
  lockdown: false,
  registrations_close_at: null,
  lockdown_at: null,
  event_date: null,
  event_venue: null,
  event_registration_deadline: null,
  event_venue_map_url: null,
  team_max_members: null,
  site_name: null,
  site_title: null,
  hero_badge: null,
  tagline: null,
  site_description: null,
  footer_text: null,
};

// Shown to participants when they try something that is currently switched off.
export const CLOSED_MESSAGES: Record<SettingKey, string> = {
  registrations_open: "Registrations are closed. New accounts cannot be created right now.",
  profile_editing_open: "Profile editing is closed by the organizers.",
  team_creation_open: "Creating teams is closed by the organizers.",
  team_joining_open: "Joining teams is closed by the organizers.",
  team_matching_open:
    "Team matching (requests, invitations and listings) is closed by the organizers.",
  team_changes_open: "Team changes are locked by the organizers.",
  selection_status_visible: "Selection statuses are not available yet.",
  finalists_visible: "Finalists have not been announced yet.",
  participant_login_open: "Logging in is paused by the organizers. Please try again later.",
  project_submissions_open: "Project submissions are not open right now.",
};

// The message for a feature that is off: the lockdown message when lockdown is on.
export function closedMessage(settings: { lockdown: boolean }, key: SettingKey): string {
  return settings.lockdown ? LOCKDOWN_MESSAGE : CLOSED_MESSAGES[key];
}

export type SettingGroup = {
  title: string;
  description: string;
  items: { key: SettingKey; label: string; description: string }[];
};

export const SETTING_GROUPS: SettingGroup[] = [
  {
    title: "Registration and profiles",
    description: "Who can create an account and change their details.",
    items: [
      {
        key: "registrations_open",
        label: "Registrations",
        description: "New participants can create an account. Existing accounts can still log in.",
      },
      {
        key: "profile_editing_open",
        label: "Profile editing",
        description:
          "Participants can edit a completed profile. People who have not finished their profile can still finish it.",
      },
    ],
  },
  {
    title: "Access",
    description: "Who can sign in.",
    items: [
      {
        key: "participant_login_open",
        label: "Participant logins",
        description:
          "Participants can log in. Turn off for maintenance: people already signed in are not logged out, and administrators can always log in.",
      },
    ],
  },
  {
    title: "Teams",
    description: "Forming and changing teams.",
    items: [
      {
        key: "team_creation_open",
        label: "Team creation",
        description: "Participants can create new teams.",
      },
      {
        key: "team_joining_open",
        label: "Team joining",
        description:
          "Participants can join through an invitation link, send join requests, and accept requests or invitations. Turn off to freeze team rosters.",
      },
      {
        key: "team_matching_open",
        label: "Team matching",
        description:
          "Participants can send join requests and invitations and use the Looking for a Team list. Declining and cancelling always work.",
      },
      {
        key: "team_changes_open",
        label: "Team changes",
        description:
          "Participants can leave a team, and leaders can remove members, transfer leadership or dissolve their team.",
      },
    ],
  },
  {
    title: "Projects",
    description: "What selected teams can submit.",
    items: [
      {
        key: "project_submissions_open",
        label: "Project submissions",
        description:
          "Leaders of selected teams can add or change their project's GitHub repository link on their team page. Links appear in the Teams tab here. Off by default.",
      },
    ],
  },
  {
    title: "Visibility",
    description: "What participants and visitors can see.",
    items: [
      {
        key: "selection_status_visible",
        label: "Selection statuses",
        description:
          "Participants see their team's selection status. Turn off while you decide, then turn on to announce. Status notifications are held back and appear when you turn it on.",
      },
      {
        key: "finalists_visible",
        label: "Finalists page",
        description:
          "The Finalists page and tab show the finalists and winners, to participants whose team is Selected (and to admins).",
      },
    ],
  },
];

// Closing these locks everything participants can change. Visibility stays as it is.
export const LOCK_ALL_KEYS: SettingKey[] = [
  "registrations_open",
  "profile_editing_open",
  "team_creation_open",
  "team_joining_open",
  "team_matching_open",
  "team_changes_open",
  "project_submissions_open",
];

export const BROADCAST_AUDIENCES = [
  { value: "all", label: "All participants" },
  { value: "selected", label: "Members of selected teams" },
  { value: "leaders", label: "Team leaders" },
] as const;

export const broadcastSchema = z.object({
  title: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(1, "Add a title.").max(120, "Use at most 120 characters.")),
  body: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(500, "Use at most 500 characters.")),
  audience: z.enum(["all", "selected", "leaders"]),
});

export const EVENT_DETAIL_KEYS = [
  "event_date",
  "event_venue",
  "event_registration_deadline",
  "event_venue_map_url",
] as const;
const eventTextSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().max(100, "Use at most 100 characters."));

// A map link must be https; anything else (javascript:, http:, spaces) is rejected.
const mapUrlSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .max(500, "Use at most 500 characters.")
      .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "Use a link that starts with https://"),
  );

export const BRANDING_KEYS = [
  "site_name",
  "site_title",
  "hero_badge",
  "tagline",
  "site_description",
  "footer_text",
] as const;
export type BrandingKey = (typeof BRANDING_KEYS)[number];

export const BRANDING_LIMITS: Record<BrandingKey, number> = {
  site_name: 60,
  site_title: 100,
  hero_badge: 100,
  tagline: 150,
  site_description: 400,
  footer_text: 150,
};

export const DEFAULT_HERO_BADGE = "In Collaboration with BUILDFEST KASHMIR";

// The website text everything should show: the admin's override, or the default.
export function branding(settings: SiteSettings) {
  const name = settings.site_name ?? eventConfig.name;
  return {
    name,
    title: settings.site_title ?? `${name} — Registration`,
    badge: settings.hero_badge ?? DEFAULT_HERO_BADGE,
    tagline: settings.tagline ?? eventConfig.tagline,
    description: settings.site_description ?? eventConfig.description,
    // null means the standard "© year name." line.
    footer: settings.footer_text,
  };
}

const limitedText = (max: number) =>
  z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(max, `Use at most ${max} characters.`));

// The team size everything should show and use.
export function teamSize(settings: { team_max_members: number | null }): number {
  return settings.team_max_members ?? eventConfig.team.maxMembers;
}

export const MIN_TEAM_SIZE = 2;
export const MAX_TEAM_SIZE = 20;

export const teamSizeSchema = z.coerce
  .number({ message: "Enter a number." })
  .int("Use a whole number.")
  .min(MIN_TEAM_SIZE, `The smallest team size is ${MIN_TEAM_SIZE}.`)
  .max(MAX_TEAM_SIZE, `The largest team size is ${MAX_TEAM_SIZE}.`);

export const announcementSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().max(300, "Use at most 300 characters."));

export const settingsChangeSchema = z
  .object({
    registrations_open: z.boolean(),
    profile_editing_open: z.boolean(),
    team_creation_open: z.boolean(),
    team_joining_open: z.boolean(),
    team_matching_open: z.boolean(),
    team_changes_open: z.boolean(),
    selection_status_visible: z.boolean(),
    finalists_visible: z.boolean(),
    lockdown: z.boolean(),
    participant_login_open: z.boolean(),
    project_submissions_open: z.boolean(),
    registrations_close_at: z.union([z.string().datetime({ offset: true }), z.null()]),
    lockdown_at: z.union([z.string().datetime({ offset: true }), z.null()]),
    event_date: z.union([eventTextSchema, z.null()]),
    event_venue: z.union([eventTextSchema, z.null()]),
    event_registration_deadline: z.union([eventTextSchema, z.null()]),
    event_venue_map_url: z.union([mapUrlSchema, z.null()]),
    site_name: z.union([limitedText(BRANDING_LIMITS.site_name), z.null()]),
    site_title: z.union([limitedText(BRANDING_LIMITS.site_title), z.null()]),
    hero_badge: z.union([limitedText(BRANDING_LIMITS.hero_badge), z.null()]),
    tagline: z.union([limitedText(BRANDING_LIMITS.tagline), z.null()]),
    site_description: z.union([limitedText(BRANDING_LIMITS.site_description), z.null()]),
    footer_text: z.union([limitedText(BRANDING_LIMITS.footer_text), z.null()]),
    announcement: z.union([announcementSchema, z.null()]),
  })
  .partial()
  .strict();
