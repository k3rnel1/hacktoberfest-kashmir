import { getActionAdmin } from "@/lib/auth";
import {
  listUsers,
  parseListParams,
  parseUserFilters,
  USER_SORTS,
  type AdminUserRow,
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
  const user = session.user;

  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const params = parseListParams(sp, USER_SORTS, "created_at");
  const filters = parseUserFilters(sp);

  const rows: AdminUserRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += BATCH) {
    const page = await listUsers(params, filters, { limit: BATCH, offset });
    rows.push(...page.rows);
    if (page.rows.length < BATCH) break;
  }

  const csv = toCsv(
    [
      "Username",
      "Full name",
      "Mobile number",
      "Gmail",
      "GitHub username",
      "LinkedIn",
      "Team",
      "Team role",
      "Team selection status",
      "Selection status updated at (UTC)",
      "Selection status updated by",
      "Profile complete",
      "Registered at (UTC)",
    ],
    rows.map((r) => [
      r.username,
      r.full_name,
      r.mobile_number,
      r.gmail,
      r.github_username,
      r.linkedin_url,
      r.team_name,
      r.team_role,
      selectionLabel(r.selection_status),
      r.selection_status_updated_at,
      r.selection_status_updated_by,
      r.profile_completed ? "yes" : "no",
      r.created_at,
    ]),
  );

  await createAdminClient().rpc("admin_log", {
    p_admin_id: user.id,
    p_action: "export_participants_csv",
    p_target_type: "participants",
    p_target_id: null,
    p_metadata: { row_count: rows.length, filters, search: params.q || null },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hacktoberfest-kashmir-participants-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
