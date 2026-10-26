"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  dbError,
  fail,
  formToObject,
  invalid,
  SESSION_EXPIRED,
  TOO_MANY,
  type ActionResult,
} from "@/lib/action";
import { closedResult, getSettings, lockdownResult } from "@/lib/settings";
import { teamSize } from "@/lib/site-settings";
import { getActionUser } from "@/lib/auth";
import { deriveInviteToken, hashInviteToken, inviteUrl } from "@/lib/invite";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { projectRepoSchema } from "@/lib/project-schema";
import { INVITE_TOKEN_PATTERN, teamSchema, uuidSchema } from "@/lib/validation";

// Every action takes the acting user from the verified session, never from the
// client. The database functions re-check leadership/membership on their own.

export async function createTeamAction(formData: FormData): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  {
    const closed = await closedResult("team_creation_open");
    if (closed) return closed;
  }

  const parsed = teamSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  if (!(await rateLimit(`create-team:${session.user.id}`, 5, 60 * 60))) return fail(TOO_MANY);

  const teamId = randomUUID();
  const token = deriveInviteToken(teamId, 1);

  const admin = createAdminClient();
  const { error } = await admin.rpc("create_team", {
    p_user_id: session.user.id,
    p_team_id: teamId,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_token_hash: hashInviteToken(token),
    p_max_members: teamSize(await getSettings()),
    p_expires_at: null,
  });

  if (error) {
    const message = dbError(error.message);
    return fail(
      message,
      error.message === "TEAM_NAME_TAKEN" ? { name: message } : undefined,
    );
  }

  revalidatePath("/dashboard");
  redirect(`/team/${teamId}?created=1`);
}

export async function joinTeamAction(token: string): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  {
    const closed = await closedResult("team_joining_open");
    if (closed) return closed;
  }
  if (!INVITE_TOKEN_PATTERN.test(token)) return fail(dbError("INVITE_INVALID"));

  if (!(await rateLimit(`join:${session.user.id}`, 10, 10 * 60))) return fail(TOO_MANY);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("join_team", {
    p_user_id: session.user.id,
    p_token_hash: hashInviteToken(token),
  });
  if (error) return fail(dbError(error.message));

  revalidatePath("/dashboard");
  redirect(`/team/${data}?joined=1`);
}

export async function leaveTeamAction(): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  {
    const closed = await closedResult("team_changes_open");
    if (closed) return closed;
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("leave_team", { p_user_id: session.user.id });
  if (error) return fail(dbError(error.message));

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function transferLeadershipAction(newLeaderId: string): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  {
    const closed = await closedResult("team_changes_open");
    if (closed) return closed;
  }
  if (!uuidSchema.safeParse(newLeaderId).success) return fail(dbError("TARGET_NOT_MEMBER"));

  const admin = createAdminClient();
  const { error } = await admin.rpc("transfer_leadership", {
    p_actor_id: session.user.id,
    p_new_leader_id: newLeaderId,
  });
  if (error) return fail(dbError(error.message));

  revalidatePath("/", "layout");
  return { ok: true, message: "Leadership transferred." };
}

// The leader removes a member of their own team. The team is derived from the
// caller's leadership in the database, so the browser cannot choose which team.
export async function kickMemberAction(userId: string): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  {
    const closed = await closedResult("team_changes_open");
    if (closed) return closed;
  }
  if (!uuidSchema.safeParse(userId).success) return fail(dbError("MEMBER_NOT_FOUND"));
  if (!(await rateLimit(`kick-member:${session.user.id}`, 30, 60 * 60))) return fail(TOO_MANY);

  const admin = createAdminClient();
  const { error } = await admin.rpc("kick_team_member", {
    p_leader_id: session.user.id,
    p_user_id: userId,
  });
  if (error) return fail(dbError(error.message));

  revalidatePath("/", "layout");
  return { ok: true, message: "Member removed from the team." };
}

export async function dissolveTeamAction(teamId: string): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  {
    const closed = await closedResult("team_changes_open");
    if (closed) return closed;
  }
  if (!uuidSchema.safeParse(teamId).success) return fail(dbError("TEAM_NOT_FOUND"));

  const admin = createAdminClient();
  const { error } = await admin.rpc("dissolve_team", {
    p_actor_id: session.user.id,
    p_team_id: teamId,
  });
  if (error) return fail(dbError(error.message));

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function rotateInviteAction(teamId: string): Promise<ActionResult<{ url: string }>> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  {
    const locked = await lockdownResult();
    if (locked) return locked;
  }
  if (!uuidSchema.safeParse(teamId).success) return fail(dbError("TEAM_NOT_FOUND"));

  if (!(await rateLimit(`rotate-invite:${session.user.id}`, 10, 10 * 60))) return fail(TOO_MANY);

  const admin = createAdminClient();
  const { data: team } = await admin
    .from("teams")
    .select("leader_id, invite_version")
    .eq("id", teamId)
    .maybeSingle();
  if (!team || team.leader_id !== session.user.id) return fail(dbError("NOT_LEADER"));

  const nextVersion = team.invite_version + 1;
  const token = deriveInviteToken(teamId, nextVersion);
  const { error } = await admin.rpc("rotate_invite", {
    p_actor_id: session.user.id,
    p_team_id: teamId,
    p_expected_version: team.invite_version,
    p_new_hash: hashInviteToken(token),
    p_expires_at: null,
  });
  if (error) return fail(dbError(error.message));

  revalidatePath(`/team/${teamId}`);
  return { ok: true, data: { url: await inviteUrl(token) }, message: "New invitation link created." };
}

export async function revokeInviteAction(teamId: string): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  {
    const locked = await lockdownResult();
    if (locked) return locked;
  }
  if (!uuidSchema.safeParse(teamId).success) return fail(dbError("TEAM_NOT_FOUND"));

  const admin = createAdminClient();
  const { error } = await admin.rpc("revoke_invite", {
    p_actor_id: session.user.id,
    p_team_id: teamId,
  });
  if (error) return fail(dbError(error.message));

  revalidatePath(`/team/${teamId}`);
  return { ok: true, message: "Invitation link revoked." };
}

// Selected teams add their project's GitHub repository once the organizers open
// submissions. Leader only; the database checks leadership, status and the switch.
export async function submitProjectRepoAction(
  teamId: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  {
    const locked = await lockdownResult();
    if (locked) return locked;
  }
  {
    const closed = await closedResult("project_submissions_open");
    if (closed) return closed;
  }
  if (!uuidSchema.safeParse(teamId).success) return fail(dbError("INVALID_INPUT"));

  const parsed = projectRepoSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  if (!(await rateLimit(`project-repo:${session.user.id}`, 20, 60 * 60))) return fail(TOO_MANY);

  const { error } = await createAdminClient().rpc("submit_project_repo", {
    p_user_id: session.user.id,
    p_team_id: teamId,
    p_url: parsed.data.repoUrl === "" ? null : parsed.data.repoUrl,
  });
  if (error) {
    const message = dbError(error.message);
    return fail(message, error.message === "INVALID_REPO_URL" ? { repoUrl: message } : undefined);
  }

  revalidatePath(`/team/${teamId}`);
  revalidatePath("/admin", "layout");
  return {
    ok: true,
    message: parsed.data.repoUrl === "" ? "Repository link removed." : "Repository link saved.",
  };
}
