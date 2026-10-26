import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Link2, Plus } from "lucide-react";
import { PasteInvite } from "@/components/paste-invite";
import { Alert } from "@/components/ui/alert";
import {
  SelectionBadge,
  SelectionStatusCard,
} from "@/components/selection-status";
import { MemberList } from "@/components/team/member-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireCompleteProfile } from "@/lib/auth";
import { getPendingCount } from "@/lib/matching";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";
import { teamSize } from "@/lib/site-settings";
import { LOCKDOWN_MESSAGE } from "@/lib/site-settings";
import { getMyTeamId, getTeamDetail } from "@/lib/teams";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { user, profile } = await requireCompleteProfile("/dashboard");
  const teamId = await getMyTeamId(user.id);
  const team = teamId ? await getTeamDetail(teamId) : null;
  const settings = await getSettings();
  const locked = settings.lockdown;
  const matchingOn = settings.team_joining_open && settings.team_matching_open;
  const [pending, unread] = locked
    ? [0, 0]
    : await Promise.all([
        matchingOn ? getPendingCount() : 0,
        getUnreadNotificationCount(),
      ]);

  const steps = [
    { label: "Account created", done: true },
    { label: "Profile completed", done: profile.profile_completed },
    { label: "Joined a team", done: Boolean(team) },
    // The step disappears while the organizers keep selection statuses hidden.
    ...(settings.selection_status_visible
      ? [
          {
            label: "Selection status",
            // Complete only once the team has been selected; the badge shows where it stands.
            done: team?.selection_status === "selected",
            badge: team?.selection_status ? (
              <SelectionBadge status={team.selection_status} />
            ) : null,
          },
        ]
      : []),
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const leader = team?.members.find((m) => m.role === "leader");

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted">@{profile.username}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Hello, {profile.full_name?.split(" ")[0]}
          </h1>
        </div>
        {settings.profile_editing_open && (
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/profile">Edit profile</Link>
          </Button>
        )}
      </div>

      {locked && <Alert variant="info">{LOCKDOWN_MESSAGE}</Alert>}
      {settings.announcement && (
        <Alert variant="info">{settings.announcement}</Alert>
      )}

      {matchingOn && pending > 0 && (
        <Alert variant="info">
          You have {pending} team {pending === 1 ? "request" : "requests"}{" "}
          waiting for your answer.{" "}
          <Link
            href="/teams/requests"
            className="font-medium text-primary hover:underline"
          >
            Review now
          </Link>
        </Alert>
      )}

      {unread > 0 && (
        <Alert variant="info">
          You have {unread} unread{" "}
          {unread === 1 ? "notification" : "notifications"}.{" "}
          <Link
            href="/teams/notifications"
            className="font-medium text-primary hover:underline"
          >
            View notifications
          </Link>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Registration progress</CardTitle>
            <span className="font-mono text-sm text-muted">
              {doneCount}/{steps.length}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={doneCount}
            aria-label="Registration progress"
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
          >
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center gap-2">
                {step.done ? (
                  <CheckCircle2 className="size-4 text-success" aria-hidden />
                ) : (
                  <Circle className="size-4 text-muted" aria-hidden />
                )}
                <span className={step.done ? "" : "text-muted"}>
                  {step.label}
                </span>
                {step.badge}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {team ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-xl">{team.name}</CardTitle>
                <CardDescription className="mt-1">
                  Led by {leader?.full_name ?? "—"} · {team.members.length}/
                  {team.max_members} members
                </CardDescription>
              </div>
              <Badge
                variant={team.leader_id === user.id ? "primary" : "success"}
              >
                {team.leader_id === user.id
                  ? "You lead this team"
                  : "You are a member"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {settings.selection_status_visible && (
              <SelectionStatusCard status={team.selection_status} />
            )}
            <p className="text-sm text-muted">{team.description}</p>
            <MemberList
              members={team.members}
              currentUserId={user.id}
              canRemove={
                team.leader_id === user.id && settings.team_changes_open
              }
            />
            <Button asChild className="w-fit">
              <Link href={`/team/${team.id}`}>
                Open team page <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : settings.team_creation_open || settings.team_joining_open ? (
        <div className="grid gap-4 md:grid-cols-2">
          {settings.team_creation_open && (
            <Card className="flex flex-col">
              <CardHeader>
                <Plus className="size-5 text-primary" aria-hidden />
                <CardTitle className="mt-2">Create a team</CardTitle>
                <CardDescription>
                  Start a team, become its leader, and invite up to{" "}
                  {teamSize(settings) - 1} friends with a private link.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button asChild>
                  <Link href="/create-team">
                    Create a team <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {settings.team_joining_open && (
            <Card className="flex flex-col">
              <CardHeader>
                <Link2 className="size-5 text-success" aria-hidden />
                <CardTitle className="mt-2">Join a team</CardTitle>
                <CardDescription>
                  Ask your team leader for the invitation link, then open it or
                  paste it below.
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <PasteInvite />
                {matchingOn && (
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link href="/teams">Browse teams</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
