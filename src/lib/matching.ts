import "server-only";
import { createClient } from "@/lib/supabase/server";

// All reads run as the signed-in user through SECURITY DEFINER functions that use
// auth.uid() and return discovery-safe fields only (no contact details, no tokens).

export type MyRequestRef = {
  id: string;
  direction: "request" | "invitation";
  status: "pending" | "accepted" | "rejected" | "cancelled";
};

export type BrowseTeam = {
  id: string;
  name: string;
  description: string;
  leader_name: string;
  leader_linkedin_url: string | null;
  member_count: number;
  max_members: number;
  open_slots: number;
  is_open: boolean;
  is_my_team: boolean;
  // True when this team's leader removed the viewer: they cannot rejoin by link or request.
  was_removed: boolean;
  members: string[];
  my_request: MyRequestRef | null;
};

export type Seeker = {
  user_id: string;
  name: string;
  skills: string[];
  interests: string[];
  intro: string;
  preferred_role: string | null;
  portfolio_url: string | null;
  github_username: string | null;
  linkedin_url: string | null;
  is_me: boolean;
  invited: boolean;
};

export type RequestStatus = MyRequestRef["status"];

export type MatchingState = {
  team: {
    id: string;
    name: string;
    is_leader: boolean;
    member_count: number;
    max_members: number;
  } | null;
  listing: {
    skills: string[];
    interests: string[];
    intro: string;
    preferred_role: string | null;
    portfolio_url: string | null;
    updated_at: string;
  } | null;
  sent_requests: {
    id: string;
    team_id: string;
    team_name: string;
    status: RequestStatus;
    created_at: string;
    responded_at: string | null;
  }[];
  received_invitations: {
    id: string;
    team_id: string;
    team_name: string;
    leader_name: string;
    leader_linkedin_url: string | null;
    member_count: number;
    max_members: number;
    status: RequestStatus;
    created_at: string;
    responded_at: string | null;
  }[];
  incoming_requests: {
    id: string;
    user_name: string;
    github_username: string | null;
    linkedin_url: string | null;
    status: RequestStatus;
    created_at: string;
    responded_at: string | null;
  }[] | null;
  sent_invitations: {
    id: string;
    user_name: string;
    linkedin_url: string | null;
    status: RequestStatus;
    created_at: string;
    responded_at: string | null;
  }[] | null;
};

export const MATCHING_PAGE_SIZE = 60;

export async function browseTeams(q: string, onlyOpen: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("browse_teams", {
    p_q: q || null,
    p_only_open: onlyOpen,
    p_limit: MATCHING_PAGE_SIZE,
    p_offset: 0,
  });
  if (error) throw new Error("Failed to load teams");
  const result = data as { total: number; teams: BrowseTeam[] } | null;
  return { total: Number(result?.total ?? 0), teams: result?.teams ?? [] };
}

export async function browseSeekers(q: string, skill: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("browse_seekers", {
    p_q: q || null,
    p_skill: skill || null,
    p_limit: MATCHING_PAGE_SIZE,
    p_offset: 0,
  });
  if (error) throw new Error("Failed to load participants");
  const result = data as { total: number; seekers: Seeker[] } | null;
  return { total: Number(result?.total ?? 0), seekers: result?.seekers ?? [] };
}

export async function getMatchingState(): Promise<MatchingState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_matching_state");
  if (error || !data) throw new Error("Failed to load your team activity");
  return data as MatchingState;
}

export async function getPendingCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_pending_count");
  return error ? 0 : Number(data ?? 0);
}
