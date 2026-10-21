"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { dbError, fail, GENERIC_ERROR, SESSION_EXPIRED, type ActionResult } from "@/lib/action";
import { getActionAdmin, isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation";

// Every action re-verifies the caller is an administrator on the server. The UI
// hiding a button is never the security control.

async function guard(id: string) {
  const session = await getActionAdmin();
  if (!session) return { ok: false, result: fail(SESSION_EXPIRED) } as const;
  if (!uuidSchema.safeParse(id).success) return { ok: false, result: fail(GENERIC_ERROR) } as const;
  return { ok: true, adminId: session.user.id } as const;
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
