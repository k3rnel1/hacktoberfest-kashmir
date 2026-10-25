"use server";

import { revalidatePath } from "next/cache";
import {
  dbError,
  fail,
  SESSION_EXPIRED,
  TOO_MANY,
  type ActionResult,
} from "@/lib/action";
import { getActionUser } from "@/lib/auth";
import { lockdownResult } from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { uuidSchema } from "@/lib/validation";

// The acting user always comes from the verified session. The database function only
// ever updates rows that belong to that user, whatever ids the browser sends.

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  {
    const locked = await lockdownResult();
    if (locked) return locked;
  }
  if (!uuidSchema.safeParse(id).success) return fail(dbError(undefined));
  if (!(await rateLimit(`notifications:${session.user.id}`, 300, 60 * 60))) return fail(TOO_MANY);

  const { error } = await createAdminClient().rpc("mark_notifications_read", {
    p_user_id: session.user.id,
    p_ids: [id],
  });
  if (error) return fail(dbError(error.message));

  // The unread badge lives in the navigation bar, so refresh the whole layout.
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  {
    const locked = await lockdownResult();
    if (locked) return locked;
  }
  if (!(await rateLimit(`notifications:${session.user.id}`, 300, 60 * 60))) return fail(TOO_MANY);

  const { error } = await createAdminClient().rpc("mark_notifications_read", {
    p_user_id: session.user.id,
    p_ids: null,
  });
  if (error) return fail(dbError(error.message));

  revalidatePath("/", "layout");
  return { ok: true, message: "All notifications marked as read." };
}
