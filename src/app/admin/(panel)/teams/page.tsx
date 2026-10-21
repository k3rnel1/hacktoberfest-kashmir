import type { Metadata } from "next";
import Link from "next/link";
import { Link2Off } from "lucide-react";
import { Pagination, SearchBar, SortHeader } from "@/components/admin/list-controls";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { listTeams, parseListParams, TEAM_SORTS } from "@/lib/admin-data";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Teams · Admin" };

export default async function AdminTeamsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parseListParams(sp, TEAM_SORTS, "created_at");
  const { rows, total, members } = await listTeams(params);

  const path = "/admin/teams";
  const query = { q: params.q, sort: params.sort, dir: params.dir };
  const sortProps = { path, sort: params.sort, dir: params.dir, query: { q: params.q } };

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Teams</h1>
        <p className="mt-1 text-sm text-muted">{total} total</p>
      </div>

      <SearchBar
        path={path}
        q={params.q}
        placeholder="Search by team, leader name, username or team ID"
        hidden={{ sort: params.sort, dir: params.dir }}
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
          {params.q ? "No teams match your search." : "No teams have been created yet."}
        </div>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>
                <SortHeader {...sortProps} label="Team" column="name" />
              </TH>
              <TH>Description</TH>
              <TH>
                <SortHeader {...sortProps} label="Leader" column="leader_name" />
              </TH>
              <TH>Username</TH>
              <TH>
                <SortHeader {...sortProps} label="Members" column="member_count" />
              </TH>
              <TH>Member list</TH>
              <TH>
                <SortHeader {...sortProps} label="Created" column="created_at" />
              </TH>
              <TH>Team ID</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((team) => (
              <tr key={team.id}>
                <TD className="font-medium">
                  <Link href={`/admin/teams/${team.id}`} className="text-primary hover:underline">
                    {team.name}
                  </Link>
                  {team.invite_revoked && (
                    <Badge variant="destructive" className="ml-2">
                      <Link2Off className="size-3" aria-hidden /> invite revoked
                    </Badge>
                  )}
                </TD>
                <TD className="max-w-64 text-muted">
                  <span className="line-clamp-2">{team.description}</span>
                </TD>
                <TD>{team.leader_name ?? "—"}</TD>
                <TD className="font-mono text-xs">@{team.leader_username}</TD>
                <TD className="font-mono">
                  {team.member_count}/{team.max_members}
                </TD>
                <TD className="max-w-56 text-xs text-muted">
                  {(members.get(team.id) ?? []).map((m) => m.name).join(", ")}
                </TD>
                <TD className="whitespace-nowrap text-muted">{formatDate(team.created_at)}</TD>
                <TD className="font-mono text-xs text-muted" title={team.id}>
                  {team.id}
                </TD>
              </tr>
            ))}
          </TBody>
        </Table>
      )}

      <Pagination path={path} page={params.page} total={total} query={query} />
    </div>
  );
}
