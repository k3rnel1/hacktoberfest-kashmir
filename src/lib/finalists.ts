import "server-only";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type PublicFinalist = {
  name: string;
  description: string;
  award: string | null;
  award_rank: number | null;
  members: string[];
};

// Public data: team name, description, award and member names only. The database
// function never returns ids, contact details or links.
export async function getFinalists(): Promise<PublicFinalist[]> {
  const { data, error } = await createAdminClient().rpc("public_finalists");
  if (error) throw new Error("Failed to load finalists");
  return (data ?? []) as PublicFinalist[];
}

// Finalists are shown only to participants whose team is Selected, and to admins.
// The status is read with the server client so it works while statuses are hidden
// from participants' own pages.
export type FinalistsAccess = "ok" | "login" | "denied";

export async function getFinalistsAccess(): Promise<FinalistsAccess> {
  const user = await getSessionUser();
  if (!user) return "login";
  if (await isAdmin(user.id)) return "ok";

  const { data } = await createAdminClient()
    .from("team_members")
    .select("teams(selection_status)")
    .eq("user_id", user.id)
    .maybeSingle();
  const team = Array.isArray(data?.teams) ? data?.teams[0] : data?.teams;
  return team?.selection_status === "selected" ? "ok" : "denied";
}
