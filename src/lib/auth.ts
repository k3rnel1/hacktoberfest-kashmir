import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  mobile_number: string | null;
  gmail: string | null;
  github_username: string | null;
  linkedin_url: string | null;
  profile_completed: boolean;
  must_change_password: boolean;
  created_at: string;
};

// getUser() validates the JWT with Supabase Auth, so this is safe to trust for
// authorization (unlike reading the session cookie directly).
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

export const getProfile = cache(async (userId: string): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, username, full_name, mobile_number, gmail, github_username, linkedin_url, profile_completed, must_change_password, created_at",
    )
    .eq("id", userId)
    .maybeSingle();
  return data;
});

export async function isAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

function loginUrl(next: string) {
  return `/login?next=${encodeURIComponent(next)}`;
}

// Page guards -----------------------------------------------------------------

export async function requireUser(next = "/dashboard") {
  const user = await getSessionUser();
  if (!user) redirect(loginUrl(next));
  const profile = await getProfile(user.id);
  if (!profile) redirect(loginUrl(next));
  if (profile.must_change_password) {
    redirect(`/settings/password?next=${encodeURIComponent(next)}`);
  }
  return { user, profile };
}

export async function requireCompleteProfile(next = "/dashboard") {
  const session = await requireUser(next);
  if (await isAdmin(session.user.id)) redirect("/admin");
  if (!session.profile.profile_completed) {
    redirect(`/complete-profile?next=${encodeURIComponent(next)}`);
  }
  return session;
}

// Used by the password page itself, which must stay reachable while a change is forced.
export async function requireUserAllowingPasswordChange(next = "/settings/password") {
  const user = await getSessionUser();
  if (!user) redirect(loginUrl(next));
  const profile = await getProfile(user.id);
  if (!profile) redirect(loginUrl(next));
  return { user, profile };
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || !(await isAdmin(user.id))) redirect("/admin/login");
  const profile = await getProfile(user.id);
  if (profile?.must_change_password) {
    redirect("/settings/password?next=/admin");
  }
  return { user, profile };
}

// Server-action guards (return null instead of redirecting) ------------------------

export async function getActionUser() {
  const user = await getSessionUser();
  if (!user) return null;
  const profile = await getProfile(user.id);
  return profile ? { user, profile } : null;
}

export async function getActionAdmin() {
  const user = await getSessionUser();
  if (!user || !(await isAdmin(user.id))) return null;
  const profile = await getProfile(user.id);
  if (profile?.must_change_password) return null;
  return { user, profile };
}
