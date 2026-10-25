import Link from "next/link";
import { Crown, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LinkedInLink } from "@/components/linkedin-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BrowseTeam } from "@/lib/matching";
import { CancelRequestButton, RequestToJoinButton } from "./match-actions";
import { RequestStatusBadge } from "./request-status";
import { TeamDetailsDialog } from "./team-details";

function JoinAction({ team, viewerHasTeam }: { team: BrowseTeam; viewerHasTeam: boolean }) {
  const req = team.my_request;

  if (team.is_my_team) return <Badge variant="primary">Your team</Badge>;
  if (req?.status === "pending" && req.direction === "request") {
    return (
      <>
        <RequestStatusBadge status="pending" />
        <CancelRequestButton requestId={req.id} />
      </>
    );
  }
  if (req?.status === "pending" && req.direction === "invitation") {
    return (
      <Button asChild size="sm" variant="secondary">
        <Link href="/teams/requests">Review invitation</Link>
      </Button>
    );
  }
  if (viewerHasTeam) {
    return <span className="text-xs text-muted">You are already in a team</span>;
  }
  if (team.was_removed) {
    return (
      <span className="text-xs text-muted">
        The leader removed you from this team. Contact them to be invited back.
      </span>
    );
  }
  if (!team.is_open) {
    return (
      <Button size="sm" disabled>
        Team full
      </Button>
    );
  }
  return (
    <>
      {req?.status === "rejected" && <RequestStatusBadge status="rejected" />}
      <RequestToJoinButton teamId={team.id} teamName={team.name} />
    </>
  );
}

export function TeamCard({ team, viewerHasTeam }: { team: BrowseTeam; viewerHasTeam: boolean }) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="break-words text-xl">{team.name}</CardTitle>
          {team.is_open ? (
            <Badge variant="success">Open</Badge>
          ) : (
            <Badge variant="destructive">Full</Badge>
          )}
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Crown className="size-3.5" aria-hidden /> {team.leader_name}
          </span>
          <LinkedInLink
            url={team.leader_linkedin_url}
            srLabel={`${team.leader_name} (team leader) on LinkedIn`}
          />
        </p>
      </CardHeader>
      <CardContent className="mt-auto grid gap-4">
        <p className="line-clamp-3 break-words text-sm text-muted">{team.description}</p>
        <p className="flex items-center gap-1.5 text-sm">
          <Users className="size-4 text-muted" aria-hidden />
          <span className="font-mono">
            {team.member_count}/{team.max_members}
          </span>
          <span className="text-muted">
            members ·{" "}
            {team.is_open
              ? `${team.open_slots} open ${team.open_slots === 1 ? "position" : "positions"}`
              : "no open positions"}
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <TeamDetailsDialog team={team} />
          <JoinAction team={team} viewerHasTeam={viewerHasTeam} />
        </div>
      </CardContent>
    </Card>
  );
}
