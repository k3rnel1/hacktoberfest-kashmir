import { z } from "zod";
import { eventConfig } from "@/config/event";

// Shared by client forms (instant feedback) and server actions (the real check).

const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "root",
  "support",
  "staff",
  "system",
  "moderator",
  "organizer",
  "organiser",
]);

export const USERNAME_DOMAIN = "users.hacktoberfest-kashmir.invalid";

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@${USERNAME_DOMAIN}`;
}

const usernameField = z
  .string()
  .transform(normalizeUsername)
  .pipe(
    z
      .string()
      .regex(
        /^[a-z0-9_]{3,20}$/,
        "Use 3–20 characters: letters, numbers and underscores.",
      ),
  );

export const registerUsernameField = usernameField.refine(
  (value) => !RESERVED_USERNAMES.has(value),
  "This username is reserved.",
);

const passwordField = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.");

export const registerSchema = z
  .object({
    username: registerUsernameField,
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username.").max(50),
  password: z.string().min(1, "Enter your password.").max(72),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password.").max(72),
    newPassword: z
      .string()
      .min(10, "Use at least 10 characters.")
      .max(72, "Use at most 72 characters.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/[0-9]/, "Include at least one number."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a different password from the current one.",
  });

// Profile -------------------------------------------------------------------

export function normalizeMobile(input: string) {
  const compact = input.replace(/[\s\-().]/g, "");
  if (/^[6-9]\d{9}$/.test(compact)) return `+91${compact}`;
  if (/^0[6-9]\d{9}$/.test(compact)) return `+91${compact.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(compact)) return `+${compact}`;
  return compact;
}

function extractGithub(input: string) {
  const value = input.trim().replace(/^@/, "");
  const match = value.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)\/?$/i);
  return match ? match[1] : value;
}

function extractLinkedin(input: string) {
  const value = input.trim();
  const match = value.match(
    /^(?:https?:\/\/)?(?:[a-z]{2,3}\.|www\.)?linkedin\.com\/in\/([^/?#\s]+)\/?(?:[?#].*)?$/i,
  );
  const handle = match ? match[1] : value.replace(/^@/, "");
  return /^[A-Za-z0-9_%-]{3,100}$/.test(handle)
    ? `https://www.linkedin.com/in/${handle}`
    : "";
}

export const profileSchema = z.object({
  fullName: z
    .string()
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(2, "Enter your full name.").max(80, "Use at most 80 characters.")),
  mobileNumber: z
    .string()
    .transform(normalizeMobile)
    .pipe(
      z
        .string()
        .regex(/^\+[1-9]\d{7,14}$/, "Enter a valid mobile number, e.g. 9876543210.")
        .refine(
          (v) => !v.startsWith("+91") || /^\+91[6-9]\d{9}$/.test(v),
          "Indian mobile numbers have 10 digits and start with 6–9.",
        ),
    ),
  gmail: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(
      z
        .string()
        .regex(/^[a-z0-9._%+-]+@gmail\.com$/, "Enter a valid Gmail address (name@gmail.com)."),
    ),
  githubUsername: z
    .string()
    .transform(extractGithub)
    .pipe(
      z
        .string()
        .regex(
          /^[A-Za-z0-9]([A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/,
          "Enter a valid GitHub username.",
        )
        .refine((v) => !v.includes("--"), "Enter a valid GitHub username."),
    ),
  linkedinUrl: z
    .string()
    .transform(extractLinkedin)
    .pipe(
      z
        .string()
        .min(1, "Enter your LinkedIn username or profile URL (linkedin.com/in/…).")
        .max(200),
    ),
});

// Teams ---------------------------------------------------------------------

const { team } = eventConfig;

export const teamSchema = z.object({
  name: z
    .string()
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(team.minNameLength, `Use at least ${team.minNameLength} characters.`)
        .max(team.maxNameLength, `Use at most ${team.maxNameLength} characters.`)
        .regex(/^[\p{L}\p{N} _.'-]+$/u, "Use letters, numbers, spaces and . _ ' - only."),
    ),
  description: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z
        .string()
        .min(team.minDescriptionLength, `Use at least ${team.minDescriptionLength} characters.`)
        .max(team.maxDescriptionLength, `Use at most ${team.maxDescriptionLength} characters.`),
    ),
});

export const uuidSchema = z.uuid();

export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

// Helpers -------------------------------------------------------------------

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function safeNext(value: unknown, fallback = "/dashboard") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}
