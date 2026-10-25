import "server-only";
import type { SelectionStatus } from "@/lib/selection";
import { createClient } from "@/lib/supabase/server";

export type TeamMember = {
  user_id: string;
  role: "leader" | "member";
  joined_at: string;
  full_name: string | null;
  github_username: string | null;
  linkedin_url: string | null;
};

export type TeamDetail = {
  id: string;
  name: string;
  description: string;
  leader_id: string;
  max_members: number;
  created_at: string;
  // null while the organizers have hidden selection statuses.
  selection_status: SelectionStatus | null;
  selection_status_updated_at: string | null;
  members: TeamMember[];
};

export type InvitePreview =
  | { status: "invalid" }
  | {
      status: "ok" | "revoked" | "expired" | "full";
      team_id: string;
      team_name: string;
      description: string;
      leader_name: string | null;
      member_count: number;
      max_members: number;
      already_member: boolean;
    };

// All reads below run as the signed-in user, so RLS and the member-scoped
// database functions decide what is visible.

export async function getMyTeamId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.team_id ?? null;
}

export async function getTeamDetail(teamId: string): Promise<TeamDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("team_detail_for_member", { p_team_id: teamId });
  return (data as TeamDetail | null) ?? null;
}

export async function getInviteState(teamId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("teams")
    .select("invite_version, invite_revoked, invite_expires_at")
    .eq("id", teamId)
    .maybeSingle();
  return data;
}

export async function getInvitePreview(tokenHash: string): Promise<InvitePreview> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_preview", { p_token_hash: tokenHash });
  return (data as InvitePreview | null) ?? { status: "invalid" };
}

export function githubUrl(username: string) {
  return `https://github.com/${encodeURIComponent(username)}`;
}
