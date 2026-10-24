import type { ZodError } from "zod";
import { fieldErrors } from "@/lib/validation";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function fail(error: string, fields?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors: fields };
}

export function invalid(error: ZodError): ActionResult<never> {
  return fail("Please fix the highlighted fields.", fieldErrors(error));
}

export function formToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}

export const SESSION_EXPIRED = "Your session has expired. Please log in again.";
export const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
export const GENERIC_ERROR = "Something went wrong. Please try again.";

// Database function error codes (see supabase/migrations) → user-facing text.
const DB_ERRORS: Record<string, string> = {
  PROFILE_INCOMPLETE: "Complete your profile before creating or joining a team.",
  ALREADY_IN_TEAM: "You already belong to a team.",
  ALREADY_MEMBER: "You are already a member of this team.",
  TEAM_NAME_TAKEN: "A team with this name already exists.",
  INVALID_INPUT: "Some of the details are not valid.",
  INVITE_INVALID: "This invitation link is invalid or has been replaced.",
  INVITE_REVOKED: "This invitation link has been revoked by the team leader.",
  INVITE_EXPIRED: "This invitation link has expired.",
  TEAM_FULL: "This team is full.",
  NOT_IN_TEAM: "You are not in a team.",
  LEADER_CANNOT_LEAVE:
    "Team leaders cannot leave. Transfer leadership to another member or dissolve the team.",
  NOT_LEADER: "Only the team leader can do this.",
  TARGET_NOT_MEMBER: "Choose another member of your team.",
  INVITE_VERSION_CONFLICT: "The invitation changed at the same time. Please try again.",
  REMOVE_LEADER_BLOCKED:
    "This user is the team leader. Dissolve the team instead of removing the leader.",
  TEAM_NOT_FOUND: "That team no longer exists.",
  INVALID_STATUS: "Choose a valid selection status.",
  NOT_SELECTED: "Only teams with the Selected status can be finalists.",
  DUPLICATE_REQUEST: "There is already a pending request or invitation between you and this team.",
  REQUEST_NOT_FOUND: "That request no longer exists.",
  REQUEST_NOT_PENDING: "That request has already been answered or cancelled.",
  TARGET_NOT_LOOKING: "This participant is no longer looking for a team.",
  TARGET_UNAVAILABLE: "This participant has already joined a team.",
  CANNOT_REMOVE_SELF:
    "You cannot remove yourself. Transfer leadership to another member or dissolve the team.",
  MEMBER_NOT_FOUND: "That person is no longer a member of your team.",
  REMOVED_FROM_TEAM:
    "The leader of this team removed you from it, so you cannot rejoin with a link or request. Ask the leader to invite you directly.",
};

export function dbError(message: string | undefined): string {
  if (message && message in DB_ERRORS) return DB_ERRORS[message];
  return GENERIC_ERROR;
}
