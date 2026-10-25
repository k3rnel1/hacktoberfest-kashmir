"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  fail,
  formToObject,
  GENERIC_ERROR,
  invalid,
  SESSION_EXPIRED,
  TOO_MANY,
  type ActionResult,
} from "@/lib/action";
import { getActionUser, isAdmin } from "@/lib/auth";
import { closedResult, lockdownResult } from "@/lib/settings";
import { CLOSED_MESSAGES, LOCKDOWN_MESSAGE } from "@/lib/site-settings";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { profileSchema, safeNext } from "@/lib/validation";

export async function saveProfileAction(formData: FormData): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);
  if (await isAdmin(session.user.id)) return fail("Administrators do not have a participant profile.");

  // Finishing a first-time profile is always allowed; editing a completed one can be
  // switched off. The database enforces the same rule for direct API calls.
  {
    const locked = await lockdownResult();
    if (locked) return locked;
  }
  if (session.profile.profile_completed) {
    const closed = await closedResult("profile_editing_open");
    if (closed) return closed;
  }

  const raw = formToObject(formData);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);

  if (!(await rateLimit(`profile:${session.user.id}`, 20, 10 * 60))) return fail(TOO_MANY);

  // Uses the signed-in user's own client: RLS only lets them update their own row,
  // and column grants limit which fields they may change.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      mobile_number: parsed.data.mobileNumber,
      gmail: parsed.data.gmail,
      github_username: parsed.data.githubUsername,
      linkedin_url: parsed.data.linkedinUrl,
    })
    .eq("id", session.user.id)
    .select("id");

  if (error?.message === "LOCKDOWN") return fail(LOCKDOWN_MESSAGE);
  if (error?.message === "PROFILE_EDITING_CLOSED") return fail(CLOSED_MESSAGES.profile_editing_open);
  if (error || !data?.length) return fail(GENERIC_ERROR);

  revalidatePath("/", "layout");

  if (raw.mode === "complete") {
    redirect(safeNext(raw.next));
  }
  return { ok: true, message: "Profile updated." };
}
