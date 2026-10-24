import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { TeamCard } from "@/components/teams/team-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireCompleteProfile } from "@/lib/auth";
import { browseTeams, MATCHING_PAGE_SIZE } from "@/lib/matching";
import { getMyTeamId } from "@/lib/teams";

export const metadata: Metadata = { title: "Browse Teams", robots: { index: false } };

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function BrowseTeamsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (first(sp.q) ?? "").trim().slice(0, 100);
  const onlyOpen = first(sp.show) === "open";

  const { user } = await requireCompleteProfile("/teams");
  const [{ total, teams }, myTeamId] = await Promise.all([
    browseTeams(q, onlyOpen),
    getMyTeamId(user.id),
  ]);

  return (
    <div className="grid gap-5">
      <form action="/teams" method="get" role="search" className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-60 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by team name"
            aria-label="Search teams by name"
            maxLength={100}
            className="pl-9"
          />
        </div>
        <label className="grid gap-1 text-xs text-muted">
          Availability
          <select
            name="show"
            defaultValue={onlyOpen ? "open" : "all"}
            className="h-10 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
          >
            <option value="all">All teams</option>
            <option value="open">Open positions only</option>
          </select>
        </label>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      <p className="text-sm text-muted">
        {total} {total === 1 ? "team" : "teams"}
        {total > MATCHING_PAGE_SIZE && ` · showing the first ${MATCHING_PAGE_SIZE}, refine your search to see others`}
      </p>

      {myTeamId && (
        <p className="text-sm text-muted">
          You are already in a team, so joining other teams is turned off.{" "}
          <Link href={`/team/${myTeamId}`} className="text-primary hover:underline">
            Open your team
          </Link>
        </p>
      )}

      {teams.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
          {q || onlyOpen
            ? "No teams match your search."
            : "No teams have been created yet. Be the first to create one from your dashboard."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} viewerHasTeam={Boolean(myTeamId)} />
          ))}
        </div>
      )}
    </div>
  );
}
