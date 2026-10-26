import type { Metadata } from "next";
import Link from "next/link";
import { Crown, FileText, UserCheck, UserMinus, Users, UsersRound } from "lucide-react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { getStats, listTeamRows } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  const stats = await getStats();
  const selected = await listTeamRows({ q: "", sort: "name", dir: "asc", page: 1 }, "selected", {
    limit: 10,
    offset: 0,
  });

  const cards = [
    { label: "Registered users", value: stats.total_users, icon: Users, href: "/admin/users" },
    {
      label: "Completed profiles",
      value: stats.completed_profiles,
      icon: UserCheck,
      href: "/admin/users?completed=complete",
    },
    { label: "Teams", value: stats.total_teams, icon: UsersRound, href: "/admin/teams" },
    {
      label: "Team leaders",
      value: stats.total_leaders,
      icon: Crown,
      href: "/admin/users?role=leader",
    },
    {
      label: "Not in a team",
      value: stats.users_without_team,
      icon: UserMinus,
      href: "/admin/users?membership=no_team",
    },
    {
      label: "Team members (incl. leaders)",
      value: stats.total_team_members,
      icon: FileText,
      href: "/admin/users?membership=in_team",
    },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted">Live registration numbers. Administrator accounts are not counted.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="group">
            <Card className="p-5 transition-colors group-hover:border-primary/50">
              <Icon className="mb-4 size-4 text-primary" aria-hidden />
              <p className="font-mono text-3xl font-semibold">{value}</p>
              <p className="mt-1 text-sm text-muted">{label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <section className="grid gap-3" aria-labelledby="selected-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="selected-heading" className="text-xl font-semibold">
              Selected teams
            </h2>
            <p className="mt-1 text-sm text-muted">
              {selected.total} selected {selected.total === 1 ? "team" : "teams"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/selected-teams">View all</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              {/* A plain link: the export is a file download from a server route. */}
              <a href="/admin/selected-teams/export" download>
                <Download /> Export CSV
              </a>
            </Button>
          </div>
        </div>
        {selected.rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted">
            No teams have been selected yet.
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Team name</TH>
                <TH>Team leader</TH>
                <TH>Project repository</TH>
              </tr>
            </THead>
            <TBody>
              {selected.rows.map((team) => (
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
        {selected.total > selected.rows.length && (
          <p className="text-xs text-muted">
            Showing the first {selected.rows.length}. Use View all for the rest.
          </p>
        )}
      </section>
    </div>
  );
}
