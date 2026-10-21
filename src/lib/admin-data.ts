import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// These helpers use the service-role client and return private participant data.
// Callers MUST have passed requireAdmin() / getActionAdmin() first.

export const PAGE_SIZE = 25;

export type AdminStats = {
  total_users: number;
  completed_profiles: number;
  total_teams: number;
  total_leaders: number;
  users_without_team: number;
  total_team_members: number;
};

export type AdminUserRow = {
  id: string;
  username: string;
  full_name: string | null;
  mobile_number: string | null;
  gmail: string | null;
  github_username: string | null;
  linkedin_url: string | null;
  profile_completed: boolean;
  created_at: string;
  team_id: string | null;
  team_name: string | null;
  team_role: "leader" | "member" | null;
  total_count: number;
};

export type AdminTeamRow = {
  id: string;
  name: string;
  description: string;
  leader_id: string;
  leader_name: string | null;
  leader_username: string;
  member_count: number;
  max_members: number;
  invite_revoked: boolean;
  created_at: string;
  total_count: number;
};

export type AdminTeamDetail = {
  id: string;
  name: string;
  description: string;
  leader_id: string;
  max_members: number;
  invite_revoked: boolean;
  invite_expires_at: string | null;
  created_at: string;
  members: {
    user_id: string;
    role: "leader" | "member";
    joined_at: string;
    username: string;
    full_name: string | null;
    mobile_number: string | null;
    gmail: string | null;
    github_username: string | null;
    linkedin_url: string | null;
  }[];
};

export type ListParams = {
  q: string;
  page: number;
  sort: string;
  dir: "asc" | "desc";
};

export type UserFilters = {
  membership: "all" | "in_team" | "no_team";
  role: "all" | "leader" | "member";
  completed: "all" | "complete" | "incomplete";
};

type SP = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function parseListParams(sp: SP, sorts: readonly string[], defaultSort: string): ListParams {
  const page = Number.parseInt(first(sp.page) ?? "1", 10);
  return {
    q: (first(sp.q) ?? "").trim().slice(0, 100),
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 10000) : 1,
    sort: pick(first(sp.sort), sorts, defaultSort),
    dir: pick(first(sp.dir), ["asc", "desc"] as const, "desc"),
  };
}

export function parseUserFilters(sp: SP): UserFilters {
  return {
    membership: pick(first(sp.membership), ["all", "in_team", "no_team"] as const, "all"),
    role: pick(first(sp.role), ["all", "leader", "member"] as const, "all"),
    completed: pick(first(sp.completed), ["all", "complete", "incomplete"] as const, "all"),
  };
}

export const USER_SORTS = ["created_at", "username", "full_name", "gmail", "team_name", "team_role", "profile_completed"] as const;
export const TEAM_SORTS = ["created_at", "name", "leader_name", "member_count"] as const;

export async function getStats(): Promise<AdminStats> {
  const { data, error } = await createAdminClient().rpc("admin_stats");
  if (error) throw new Error("Failed to load statistics");
  return data as AdminStats;
}

export async function listUsers(
  params: ListParams,
  filters: UserFilters,
  paging: { limit: number; offset: number } = {
    limit: PAGE_SIZE,
    offset: (params.page - 1) * PAGE_SIZE,
  },
) {
  const { data, error } = await createAdminClient().rpc("admin_list_users", {
    p_q: params.q || null,
    p_membership: filters.membership,
    p_role: filters.role,
    p_completed: filters.completed,
    p_sort: params.sort,
    p_dir: params.dir,
    p_limit: paging.limit,
    p_offset: paging.offset,
  });
  if (error) throw new Error("Failed to load participants");
  const rows = (data ?? []) as AdminUserRow[];
  return { rows, total: Number(rows[0]?.total_count ?? 0) };
}

export async function listTeams(params: ListParams) {
  const { data, error } = await createAdminClient().rpc("admin_list_teams", {
    p_q: params.q || null,
    p_sort: params.sort,
    p_dir: params.dir,
    p_limit: PAGE_SIZE,
    p_offset: (params.page - 1) * PAGE_SIZE,
  });
  if (error) throw new Error("Failed to load teams");
  const rows = (data ?? []) as AdminTeamRow[];

  // Member names for the rows on this page, in one query.
  const members = new Map<string, { name: string; role: string }[]>();
  if (rows.length) {
    const { data: memberRows } = await createAdminClient()
      .from("team_members")
      .select("team_id, role, joined_at, profiles(full_name, username)")
      .in("team_id", rows.map((r) => r.id))
      .order("joined_at");
    for (const m of memberRows ?? []) {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      const list = members.get(m.team_id) ?? [];
      list.push({ name: profile?.full_name ?? profile?.username ?? "—", role: m.role });
      members.set(m.team_id, list);
    }
  }

  return { rows, total: Number(rows[0]?.total_count ?? 0), members };
}

export async function getTeam(teamId: string): Promise<AdminTeamDetail | null> {
  const { data } = await createAdminClient().rpc("admin_team_detail", { p_team_id: teamId });
  return (data as AdminTeamDetail | null) ?? null;
}

export async function listAuditLogs(page: number) {
  const admin = createAdminClient();
  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await admin
    .from("admin_audit_logs")
    .select("id, admin_user_id, action, target_type, target_id, metadata, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const ids = [...new Set((data ?? []).map((r) => r.admin_user_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await admin.from("profiles").select("id, username").in("id", ids);
    for (const p of profiles ?? []) names.set(p.id, p.username);
  }
  return { rows: data ?? [], total: count ?? 0, names };
}
