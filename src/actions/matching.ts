"use server";

import { revalidatePath } from "next/cache";
import {
  dbError,
  fail,
  formToObject,
  invalid,
  SESSION_EXPIRED,
  TOO_MANY,
  type ActionResult,
} from "@/lib/action";
import { getActionUser } from "@/lib/auth";
import { listingSchema } from "@/lib/matching-schema";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation";

// Every action takes the acting user from the verified session, never from the
// client. Team ids, request ids and statuses from the browser are only identifiers:
// the database functions re-check who may do what, and the invitation's team is
// derived from the caller's own leadership.

function refresh() {
  // Membership may have changed, so refresh everything that shows teams.
  revalidatePath("/", "layout");
}

export async function requestToJoinAction(teamId: string): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  if (!uuidSchema.safeParse(teamId).success) return fail(dbError("TEAM_NOT_FOUND"));
  if (!(await rateLimit(`request-join:${session.user.id}`, 20, 60 * 60))) return fail(TOO_MANY);

  const { error } = await createAdminClient().rpc("request_to_join", {
    p_user_id: session.user.id,
    p_team_id: teamId,
  });
  if (error) return fail(dbError(error.message));

  refresh();
  return { ok: true, message: "Request sent. The team leader will review it." };
}

export async function cancelRequestAction(requestId: string): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  if (!uuidSchema.safeParse(requestId).success) return fail(dbError("REQUEST_NOT_FOUND"));
  if (!(await rateLimit(`cancel-request:${session.user.id}`, 60, 60 * 60))) return fail(TOO_MANY);

  const { error } = await createAdminClient().rpc("cancel_team_request", {
    p_actor_id: session.user.id,
    p_request_id: requestId,
  });
  if (error) return fail(dbError(error.message));

  refresh();
  return { ok: true, message: "Cancelled." };
}

export async function respondToRequestAction(
  requestId: string,
  accept: boolean,
): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  if (!uuidSchema.safeParse(requestId).success) return fail(dbError("REQUEST_NOT_FOUND"));
  if (typeof accept !== "boolean") return fail(dbError("INVALID_INPUT"));
  if (!(await rateLimit(`respond-request:${session.user.id}`, 60, 60 * 60))) return fail(TOO_MANY);

  const { error } = await createAdminClient().rpc("respond_to_team_request", {
    p_actor_id: session.user.id,
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) return fail(dbError(error.message));

  refresh();
  return { ok: true, message: accept ? "Accepted. The new member has joined the team." : "Declined." };
}

export async function sendInvitationAction(participantId: string): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  if (!uuidSchema.safeParse(participantId).success) return fail(dbError("TARGET_UNAVAILABLE"));
  if (!(await rateLimit(`send-invitation:${session.user.id}`, 30, 60 * 60))) return fail(TOO_MANY);

  const { error } = await createAdminClient().rpc("send_team_invitation", {
    p_leader_id: session.user.id,
    p_user_id: participantId,
  });
  if (error) return fail(dbError(error.message));

  refresh();
  return { ok: true, message: "Invitation sent." };
}

export async function saveListingAction(formData: FormData): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);

  const parsed = listingSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  if (!(await rateLimit(`listing:${session.user.id}`, 30, 60 * 60))) return fail(TOO_MANY);

  const { error } = await createAdminClient().rpc("upsert_looking_listing", {
    p_user_id: session.user.id,
    p_skills: parsed.data.skills,
    p_interests: parsed.data.interests,
    p_intro: parsed.data.intro,
    p_role: parsed.data.preferredRole,
    p_portfolio: parsed.data.portfolioUrl,
  });
  if (error) return fail(dbError(error.message));

  refresh();
  return { ok: true, message: "You are now listed as looking for a team." };
}

export async function withdrawListingAction(): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);

  const { error } = await createAdminClient().rpc("withdraw_looking_listing", {
    p_user_id: session.user.id,
  });
  if (error) return fail(dbError(error.message));

  refresh();
  return { ok: true, message: "Your listing was removed." };
}
