import { getActionAdmin } from "@/lib/auth";
import { FINALIST_SORTS, listTeamRows, parseListParams, type AdminTeamRow } from "@/lib/admin-data";
import { toCsv } from "@/lib/csv";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BATCH = 1000;
const MAX_ROWS = 20000;

export async function GET(request: Request) {
  // Authorized on the server for every request; visiting the URL is not enough.
  const session = await getActionAdmin();
  if (!session) return new Response("Forbidden", { status: 403 });

  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const params = parseListParams(sp, FINALIST_SORTS, "name");

  const rows: AdminTeamRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += BATCH) {
    const page = await listTeamRows(params, "selected", { limit: BATCH, offset });
    rows.push(...page.rows);
    if (page.rows.length < BATCH) break;
  }

  const csv = toCsv(
    ["Team name", "Team leader", "Project repository"],
    rows.map((r) => [r.name, r.leader_name ?? r.leader_username, r.project_repo_url]),
  );

  await createAdminClient().rpc("admin_log", {
    p_admin_id: session.user.id,
    p_action: "export_finalists_csv",
    p_target_type: "teams",
    p_target_id: null,
    p_metadata: { row_count: rows.length, search: params.q || null },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hacktoberfest-kashmir-finalists-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
