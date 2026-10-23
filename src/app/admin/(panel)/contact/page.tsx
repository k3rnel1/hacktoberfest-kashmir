import type { Metadata } from "next";
import { BulkContact, type Recipient } from "@/components/admin/bulk-contact";
import { SelectFilter } from "@/components/admin/list-controls";
import { Button } from "@/components/ui/button";
import { listUsers, parseListParams, USER_SORTS, type AdminUserRow } from "@/lib/admin-data";
import { isEmail, whatsappDigits } from "@/lib/contact";
import { SELECTION_LABELS, SELECTION_STATUSES, type SelectionStatus } from "@/lib/selection";

export const metadata: Metadata = { title: "Contact · Admin" };
export const dynamic = "force-dynamic";

const BATCH = 1000;
const MAX_ROWS = 20000;

const AUDIENCES = ["all", "in_team", "no_team", ...SELECTION_STATUSES] as const;
type Audience = (typeof AUDIENCES)[number];

const AUDIENCE_LABELS: Record<Audience, string> = {
  all: "All participants",
  in_team: "Participants in a team",
  no_team: "Participants without a team",
  ...SELECTION_LABELS,
};

function matches(row: AdminUserRow, audience: Audience) {
  if (audience === "all") return true;
  if (audience === "in_team") return row.team_id !== null;
  if (audience === "no_team") return row.team_id === null;
  return row.selection_status === (audience as SelectionStatus);
}

export default async function AdminContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.audience) ? sp.audience[0] : sp.audience;
  const audience: Audience = AUDIENCES.includes(raw as Audience) ? (raw as Audience) : "all";

  // The layout has already verified the caller is an administrator.
  const params = parseListParams({}, USER_SORTS, "created_at");
  const filters = { membership: "all", role: "all", completed: "all" } as const;
  const rows: AdminUserRow[] = [];
  for (let offset = 0; offset < MAX_ROWS; offset += BATCH) {
    const page = await listUsers(params, filters, { limit: BATCH, offset });
    rows.push(...page.rows);
    if (page.rows.length < BATCH) break;
  }

  const recipients: Recipient[] = rows
    .filter((r) => matches(r, audience))
    .map((r) => ({
      id: r.id,
      name: r.full_name ?? r.username,
      mobile: whatsappDigits(r.mobile_number) ? r.mobile_number : null,
      email: isEmail(r.gmail) ? r.gmail : null,
    }));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Contact participants</h1>
        <p className="mt-1 text-sm text-muted">
          Write one message, then open it in Gmail or WhatsApp. You review and send each one
          yourself.
        </p>
      </div>

      <form action="/admin/contact" method="get" className="flex flex-wrap items-end gap-2">
        <SelectFilter
          name="audience"
          label="Send to"
          value={audience}
          options={AUDIENCES.map((a) => ({ value: a, label: AUDIENCE_LABELS[a] }))}
        />
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      <BulkContact
        key={audience}
        audience={audience}
        audienceLabel={AUDIENCE_LABELS[audience]}
        recipients={recipients}
      />
    </div>
  );
}
