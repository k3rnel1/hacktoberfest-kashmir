"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { dbError, fail, GENERIC_ERROR, SESSION_EXPIRED, type ActionResult } from "@/lib/action";
import { getActionAdmin, isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalistSchema } from "@/lib/finalist-schema";
import { selectionLabel, selectionStatusSchema } from "@/lib/selection";
import { broadcastSchema, settingsChangeSchema, teamSizeSchema } from "@/lib/site-settings";
import { uuidSchema } from "@/lib/validation";

// Every action re-verifies the caller is an administrator on the server. The UI
// hiding a button is never the security control.

async function guard(id: string) {
  const session = await getActionAdmin();
  if (!session) return { ok: false, result: fail(SESSION_EXPIRED) } as const;
  if (!uuidSchema.safeParse(id).success) return { ok: false, result: fail(GENERIC_ERROR) } as const;
  return { ok: true, adminId: session.user.id } as const;
}

// Organizer controls: any subset of the switches and the announcement banner. The
// database function validates the keys again and records what changed in the audit log.
export async function adminUpdateSettingsAction(changes: unknown): Promise<ActionResult> {
  const session = await getActionAdmin();
  if (!session) return fail(SESSION_EXPIRED);

  const parsed = settingsChangeSchema.safeParse(changes);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  }
  if (Object.keys(parsed.data).length === 0) return { ok: true };

  const { error } = await createAdminClient().rpc("admin_update_settings", {
    p_admin_id: session.user.id,
    p_changes: parsed.data,
  });
  if (error) return fail(dbError(error.message));

  // Settings affect every page, for participants and visitors alike.
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

// Sends an in-website notification to a group of participants. It appears in their
// Notifications tab and unread badge; nothing is emailed.
export async function adminBroadcastNotificationAction(input: unknown): Promise<ActionResult> {
  const session = await getActionAdmin();
  if (!session) return fail(SESSION_EXPIRED);

  const parsed = broadcastSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const { data, error } = await createAdminClient().rpc("admin_broadcast_notification", {
    p_admin_id: session.user.id,
    p_title: parsed.data.title,
    p_body: parsed.data.body,
    p_audience: parsed.data.audience,
  });
  if (error) return fail(dbError(error.message));

  const count = Number(data ?? 0);
  return {
    ok: true,
    message: `Notification sent to ${count} ${count === 1 ? "participant" : "participants"}.`,
  };
}

// Changes the team size limit everywhere. The database refuses it while any team has more
// members than the new limit, and tells us how many teams are in the way.
export async function adminSetTeamSizeAction(size: unknown): Promise<ActionResult> {
  const session = await getActionAdmin();
  if (!session) return fail(SESSION_EXPIRED);

  const parsed = teamSizeSchema.safeParse(size);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);

  const { error } = await createAdminClient().rpc("admin_set_team_size", {
    p_admin_id: session.user.id,
    p_size: parsed.data,
  });
  if (error) {
    if (error.message === "TEAMS_EXCEED_SIZE") {
      const [count, largest] = (error.details ?? "").split(",").map(Number);
      const teams = count === 1 ? "There is 1 team" : `There are ${count || "some"} teams`;
      return fail(
        `${teams} with more than ${parsed.data} members${
          largest ? ` (the largest has ${largest})` : ""
        }. Remove members or dissolve those teams first, or choose a larger size.`,
      );
    }
    return fail(dbError(error.message));
  }

  // The size shows on the home page, dashboards, team pages and the create-team flow.
  revalidatePath("/", "layout");
  return { ok: true, message: `Team size is now ${parsed.data}.` };
}

export async function adminRemoveMemberAction(userId: string): Promise<ActionResult> {
  const g = await guard(userId);
  if (!g.ok) return g.result;

  const { error } = await createAdminClient().rpc("admin_remove_member", {
    p_admin_id: g.adminId,
    p_user_id: userId,
  });
  if (error) return fail(dbError(error.message));

  revalidatePath("/admin", "layout");
  return { ok: true, message: "Member removed from the team." };
}

// Permanently deletes a participant's account. The database function refuses admin
// accounts and leaders whose team still has other members.
export async function adminDeleteAccountAction(userId: string): Promise<ActionResult> {
  const g = await guard(userId);
  if (!g.ok) return g.result;
  if (g.adminId === userId) return fail("You cannot delete your own account here.");

  const { error } = await createAdminClient().rpc("admin_delete_account", {
    p_admin_id: g.adminId,
    p_user_id: userId,
  });
  if (error) return fail(dbError(error.message));

  revalidatePath("/admin", "layout");
  return { ok: true, message: "Account deleted." };
}

export async function adminRevokeInviteAction(teamId: string): Promise<ActionResult> {
  const g = await guard(teamId);
  if (!g.ok) return g.result;

  const { error } = await createAdminClient().rpc("admin_revoke_invite", {
    p_admin_id: g.adminId,
    p_team_id: teamId,
  });
  if (error) return fail(dbError(error.message));

  revalidatePath("/admin", "layout");
  return { ok: true, message: "Invitation link revoked." };
}

export async function adminDissolveTeamAction(teamId: string): Promise<ActionResult> {
  const g = await guard(teamId);
  if (!g.ok) return g.result;

  const { error } = await createAdminClient().rpc("admin_dissolve_team", {
    p_admin_id: g.adminId,
    p_team_id: teamId,
  });
  if (error) return fail(dbError(error.message));

  revalidatePath("/admin", "layout");
  return { ok: true, message: "Team dissolved." };
}

export async function adminSetTeamStatusAction(
  teamId: string,
  status: string,
): Promise<ActionResult> {
  const g = await guard(teamId);
  if (!g.ok) return g.result;

  const parsed = selectionStatusSchema.safeParse(status);
  if (!parsed.success) return fail(dbError("INVALID_STATUS"));

  const { error } = await createAdminClient().rpc("admin_set_team_status", {
    p_admin_id: g.adminId,
    p_team_id: teamId,
    p_status: parsed.data,
  });
  if (error) return fail(dbError(error.message));

  revalidatePath("/admin", "layout");
  // Participants read the status on every request (dynamic pages), but revalidate
  // their routes too in case a cache is introduced later.
  revalidatePath("/dashboard");
  revalidatePath(`/team/${teamId}`);
  return { ok: true, message: `Status set to ${selectionLabel(parsed.data)}.` };
}

export async function adminSetFinalistAction(
  teamId: string,
  input: { finalist: boolean; award: string; rank: string | number | null },
): Promise<ActionResult> {
  const g = await guard(teamId);
  if (!g.ok) return g.result;

  const parsed = finalistSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  }

  const { error } = await createAdminClient().rpc("admin_set_team_finalist", {
    p_admin_id: g.adminId,
    p_team_id: teamId,
    p_finalist: parsed.data.finalist,
    p_award: parsed.data.award,
    p_rank: parsed.data.rank,
  });
  if (error) return fail(dbError(error.message));

  revalidatePath("/admin", "layout");
  revalidatePath("/finalists");
  return { ok: true, message: parsed.data.finalist ? "Finalist details saved." : "Removed from finalists." };
}

// Records that an admin opened a bulk email / WhatsApp batch. Only counts are stored,
// never addresses or phone numbers.
export async function adminLogBulkContactAction(
  channel: "email" | "whatsapp",
  audience: string,
  count: number,
): Promise<void> {
  const session = await getActionAdmin();
  if (!session) return;
  if (channel !== "email" && channel !== "whatsapp") return;
  await createAdminClient().rpc("admin_log", {
    p_admin_id: session.user.id,
    p_action: "bulk_contact",
    p_target_type: "participants",
    p_target_id: null,
    p_metadata: {
      channel,
      audience: String(audience).slice(0, 40),
      recipient_count: Math.max(0, Math.min(Math.trunc(Number(count)) || 0, 100000)),
    },
  });
}

function temporaryPassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789"];
  const all = sets.join("");
  const chars = sets.map((set) => set[randomInt(set.length)]);
  while (chars.length < 16) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export async function adminResetPasswordAction(
  userId: string,
): Promise<ActionResult<{ password: string }>> {
  const g = await guard(userId);
  if (!g.ok) return g.result;

  if (await isAdmin(userId)) return fail("Administrator accounts cannot be reset here.");

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!profile) return fail("That participant no longer exists.");

  const password = temporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password });
  if (error) return fail(GENERIC_ERROR);

  await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
  // The audit entry records the action only, never the password.
  await admin.rpc("admin_log", {
    p_admin_id: g.adminId,
    p_action: "reset_password",
    p_target_type: "user",
    p_target_id: userId,
    p_metadata: {},
  });

  return { ok: true, data: { password } };
}
