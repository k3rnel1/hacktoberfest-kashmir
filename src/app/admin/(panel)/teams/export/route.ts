import { getActionAdmin } from "@/lib/auth";
import {
  getMemberNames,
  listTeamRows,
  parseListParams,
  parseTeamStatusFilter,
  TEAM_SORTS,
  type AdminTeamRow,
} from "@/lib/admin-data";
import { toCsv } from "@/lib/csv";
import { selectionLabel } from "@/lib/selection";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BATCH = 1000;
const MAX_ROWS = 20000;

export async function GET(request: Request) {
  // Authorized on the server for every request; visiting the URL is not enough.
  const session = await getActionAdmin();
  if (!session) return new Response("Forbidden", { status: 403 });

  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const params = parseListParams(sp, TEAM_SORTS, "created_at");
  const status = parseTeamStatusFilter(sp);

  const rows: AdminTeamRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += BATCH) {
    const page = await listTeamRows(params, status, { limit: BATCH, offset });
    rows.push(...page.rows);
    if (page.rows.length < BATCH) break;
  }

  const names = new Map<string, { name: string; role: string }[]>();
  for (let i = 0; i < rows.length; i += 200) {
    const part = await getMemberNames(rows.slice(i, i + 200).map((r) => r.id));
    for (const [id, list] of part) names.set(id, list);
  }

  const csv = toCsv(
    [
      "Team",
      "Selection status",
      "Selection status updated at (UTC)",
      "Team leader",
      "Leader username",
      "Members",
      "Maximum members",
      "Member names",
      "Finalist",
      "Award",
      "Project repository",
      "Created at (UTC)",
      "Team ID",
    ],
    rows.map((r) => [
      r.name,
      selectionLabel(r.selection_status),
      r.selection_status_updated_at,
      r.leader_name,
      r.leader_username,
      r.member_count,
      r.max_members,
      (names.get(r.id) ?? []).map((m) => m.name).join("; "),
      r.is_finalist ? "yes" : "no",
      r.award,
      r.project_repo_url,
      r.created_at,
      r.id,
    ]),
  );

  await createAdminClient().rpc("admin_log", {
    p_admin_id: session.user.id,
    p_action: "export_teams_csv",
    p_target_type: "teams",
    p_target_id: null,
    p_metadata: { row_count: rows.length, status, search: params.q || null },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hacktoberfest-kashmir-teams-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
