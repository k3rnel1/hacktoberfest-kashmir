"use server";

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
import { clientFingerprint, rateLimit } from "@/lib/rate-limit";
import { createAdminClient, createVerifierClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  changePasswordSchema,
  loginSchema,
  normalizeUsername,
  registerSchema,
  safeNext,
  usernameToEmail,
} from "@/lib/validation";

const INVALID_CREDENTIALS = "Invalid username or password.";

export async function registerAction(formData: FormData): Promise<ActionResult> {
  const raw = formToObject(formData);
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);

  const ip = await clientFingerprint();
  if (!(await rateLimit(`register:${ip}`, 5, 60 * 60))) return fail(TOO_MANY);

  const { username, password } = parsed.data;
  const admin = createAdminClient();

  const taken = async () => {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    return Boolean(data);
  };

  if (await taken()) {
    return fail("That username is already taken.", { username: "That username is already taken." });
  }

  // The database trigger creates the matching profile row in the same transaction.
  const { error } = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username },
  });

  if (error) {
    if (error.code === "email_exists" || (await taken())) {
      return fail("That username is already taken.", { username: "That username is already taken." });
    }
    if (error.code === "weak_password") {
      return fail("That password is too weak.", { password: "Choose a stronger password." });
    }
    return fail(GENERIC_ERROR);
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (signInError) redirect("/login");

  const next = safeNext(raw.next, "");
  redirect(next ? `/complete-profile?next=${encodeURIComponent(next)}` : "/complete-profile");
}

async function signIn(formData: FormData, scope: "user" | "admin") {
  const raw = formToObject(formData);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, result: fail(INVALID_CREDENTIALS) } as const;

  const username = normalizeUsername(parsed.data.username);
  const ip = await clientFingerprint();
  const allowed =
    (await rateLimit(`${scope}-login:ip:${ip}`, 20, 10 * 60)) &&
    (await rateLimit(`${scope}-login:user:${username}`, 8, 10 * 60));
  if (!allowed) return { ok: false, result: fail(TOO_MANY) } as const;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password: parsed.data.password,
  });
  // Same message for unknown usernames and wrong passwords (no enumeration).
  if (error || !data.user) return { ok: false, result: fail(INVALID_CREDENTIALS) } as const;

  return { ok: true, supabase, userId: data.user.id, raw } as const;
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const outcome = await signIn(formData, "user");
  if (!outcome.ok) return outcome.result;

  if (await isAdmin(outcome.userId)) redirect("/admin");
  redirect(safeNext(outcome.raw.next));
}

export async function adminLoginAction(formData: FormData): Promise<ActionResult> {
  const outcome = await signIn(formData, "admin");
  if (!outcome.ok) return outcome.result;

  if (!(await isAdmin(outcome.userId))) {
    await outcome.supabase.auth.signOut();
    return fail(INVALID_CREDENTIALS);
  }
  redirect("/admin");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function changePasswordAction(formData: FormData): Promise<ActionResult> {
  const session = await getActionUser();
  if (!session) return fail(SESSION_EXPIRED);

  const raw = formToObject(formData);
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);

  if (!(await rateLimit(`password:${session.user.id}`, 5, 15 * 60))) return fail(TOO_MANY);

  const verifier = createVerifierClient();
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: session.user.email ?? usernameToEmail(session.profile.username),
    password: parsed.data.currentPassword,
  });
  if (verifyError) {
    return fail("Your current password is incorrect.", {
      currentPassword: "Your current password is incorrect.",
    });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(session.user.id, {
    password: parsed.data.newPassword,
  });
  if (error) return fail(GENERIC_ERROR);

  await admin.from("profiles").update({ must_change_password: false }).eq("id", session.user.id);

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "others" });

  const fallback = (await isAdmin(session.user.id)) ? "/admin" : "/dashboard";
  redirect(safeNext(raw.next, fallback));
}
