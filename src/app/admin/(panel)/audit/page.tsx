import type { Metadata } from "next";
import { Pagination } from "@/components/admin/list-controls";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { listAuditLogs } from "@/lib/admin-data";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log · Admin" };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: rawPage } = await searchParams;
  const parsed = Number.parseInt(rawPage ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10000) : 1;
  const { rows, total, names } = await listAuditLogs(page);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted">
          Administrative actions. Passwords and tokens are never recorded.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
          No administrative actions have been recorded yet.
        </div>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>When</TH>
              <TH>Admin</TH>
              <TH>Action</TH>
              <TH>Target</TH>
              <TH>Details</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((row) => (
              <tr key={row.id}>
                <TD className="whitespace-nowrap text-muted">{formatDate(row.created_at)}</TD>
                <TD className="font-mono text-xs">
                  {row.admin_user_id ? `@${names.get(row.admin_user_id) ?? "unknown"}` : "—"}
                </TD>
                <TD className="font-mono text-xs">{row.action}</TD>
                <TD className="font-mono text-xs text-muted">
                  {row.target_type}
                  {row.target_id ? `:${row.target_id}` : ""}
                </TD>
                <TD className="max-w-80 break-words font-mono text-xs text-muted">
                  {Object.keys(row.metadata ?? {}).length ? JSON.stringify(row.metadata) : "—"}
                </TD>
              </tr>
            ))}
          </TBody>
        </Table>
      )}

      <Pagination path="/admin/audit" page={page} total={total} query={{}} />
    </div>
  );
}
