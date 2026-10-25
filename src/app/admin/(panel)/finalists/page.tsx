import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { href, Pagination, SearchBar, SortHeader } from "@/components/admin/list-controls";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { FINALIST_SORTS, listTeamRows, parseListParams } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Finalists · Admin" };

// Every team with the Selected status: name, leader and project repository.
export default async function AdminFinalistsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parseListParams(sp, FINALIST_SORTS, "name");
  const { rows, total } = await listTeamRows(params, "selected");

  const path = "/admin/finalists";
  const query = { q: params.q, sort: params.sort, dir: params.dir };
  const sortProps = { path, sort: params.sort, dir: params.dir, query: { q: params.q } };

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Finalists</h1>
          <p className="mt-1 text-sm text-muted">
            {total} selected {total === 1 ? "team" : "teams"}
          </p>
        </div>
        <Button asChild variant="outline">
          {/* A plain link: the export is a file download from a server route. */}
          <a
            href={href("/admin/finalists/export", {
              q: params.q,
              sort: params.sort,
              dir: params.dir,
            })}
            download
          >
            <Download /> Export CSV
          </a>
        </Button>
      </div>

      <SearchBar
        path={path}
        q={params.q}
        placeholder="Search by team or leader"
        hidden={{ sort: params.sort, dir: params.dir }}
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
          {params.q ? "No selected teams match your search." : "No teams have been selected yet."}
        </div>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>
                <SortHeader {...sortProps} label="Team name" column="name" />
              </TH>
              <TH>
                <SortHeader {...sortProps} label="Team leader" column="leader_name" />
              </TH>
              <TH>Project repository</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((team) => (
              <tr key={team.id}>
                <TD className="font-medium">
                  <Link href={`/admin/teams/${team.id}`} className="text-primary hover:underline">
                    {team.name}
                  </Link>
                </TD>
                <TD>{team.leader_name ?? team.leader_username}</TD>
                <TD className="max-w-80 text-sm">
                  {team.project_repo_url ? (
                    <a
                      href={team.project_repo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-primary hover:underline"
                    >
                      {team.project_repo_url}
                    </a>
                  ) : (
                    <span className="text-muted">Not submitted</span>
                  )}
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
