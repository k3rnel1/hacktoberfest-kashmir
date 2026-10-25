import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Crown, Users } from "lucide-react";
import { SelectionStatusCard } from "@/components/selection-status";
import { InviteManager } from "@/components/team/invite-manager";
import { MemberList } from "@/components/team/member-list";
import { LeaderActions, LeaveTeamButton } from "@/components/team/team-actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCompleteProfile } from "@/lib/auth";
import { deriveInviteToken, inviteUrl } from "@/lib/invite";
import { ProjectRepoForm } from "@/components/team/project-repo-form";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { LOCKDOWN_MESSAGE } from "@/lib/site-settings";
import { getInviteState, getTeamDetail } from "@/lib/teams";
import { formatDate } from "@/lib/utils";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Team", robots: { index: false } };

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; joined?: string }>;
}) {
  const { id } = await params;
  const { created, joined } = await searchParams;
  if (!uuidSchema.safeParse(id).success) notFound();

  const { user } = await requireCompleteProfile(`/team/${id}`);

  // Returns null unless the caller is a member, so non-members get a 404 and
  // cannot even confirm that a team exists.
  const team = await getTeamDetail(id);
  if (!team) notFound();

  const settings = await getSettings();
  const locked = settings.lockdown;

  // Project submission applies to selected teams only. Read with the server client after
  // membership was verified above, so it works even while statuses are hidden.
  const { data: projectRow } = await createAdminClient()
    .from("teams")
    .select("selection_status, project_repo_url")
    .eq("id", id)
    .maybeSingle();
  const isSelected = projectRow?.selection_status === "selected";
  const repoUrl = (projectRow?.project_repo_url as string | null) ?? null;
  const submissionsOpen = isSelected && settings.project_submissions_open && !locked;
  const isLeader = team.leader_id === user.id;
  const leader = team.members.find((m) => m.role === "leader");
  const full = team.members.length >= team.max_members;

  let invite: { url: string; revoked: boolean; expired: boolean } | null = null;
  if (isLeader && settings.team_joining_open) {
    const state = await getInviteState(id);
    if (state) {
      const token = deriveInviteToken(id, state.invite_version);
      invite = {
        url: await inviteUrl(token),
        revoked: state.invite_revoked,
        expired: Boolean(
          state.invite_expires_at &&
          new Date(state.invite_expires_at) < new Date(),
        ),
      };
    }
  }

  return (
    <div className="grid gap-6">
      {locked && <Alert variant="info">{LOCKDOWN_MESSAGE}</Alert>}
      {created && (
        <Alert variant="success">
          Team created! You&apos;re the leader. Share the invitation link below
          with your friends.
        </Alert>
      )}
      {joined && (
        <Alert variant="success">You joined the team. Welcome aboard!</Alert>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-semibold tracking-tight">
            {team.name}
          </h1>
          <p className="mt-2 max-w-2xl text-muted">{team.description}</p>
        </div>
        <Badge variant={isLeader ? "primary" : "success"} className="shrink-0">
          {isLeader ? "You are the leader" : "You are a member"}
        </Badge>
      </div>

      {settings.selection_status_visible && <SelectionStatusCard status={team.selection_status} />}

      {isSelected && (submissionsOpen || repoUrl) && (
        <Card className="grid gap-3 p-4">
          <h2 className="text-sm font-medium text-muted">Project repository</h2>
          {submissionsOpen && isLeader ? (
            <ProjectRepoForm teamId={team.id} current={repoUrl} />
          ) : (
            <>
              {repoUrl ? (
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-primary hover:underline"
                >
                  {repoUrl}
                </a>
              ) : (
                <p className="text-sm text-muted">No repository link has been submitted yet.</p>
              )}
              {submissionsOpen && (
                <p className="text-xs text-muted">
                  Only your team leader can submit or change the repository link.
                </p>
              )}
            </>
          )}
        </Card>
      )}

      <dl className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <Crown className="size-3" aria-hidden /> Team leader
          </dt>
          <dd className="mt-1 font-medium">{leader?.full_name ?? "—"}</dd>
        </Card>
        <Card className="p-4">
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <Users className="size-3" aria-hidden /> Members
          </dt>
          <dd className="mt-1 font-medium">
            {team.members.length} / {team.max_members}
          </dd>
        </Card>
        <Card className="p-4">
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            <CalendarDays className="size-3" aria-hidden /> Created
          </dt>
          <dd className="mt-1 font-medium">{formatDate(team.created_at)}</dd>
        </Card>
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section
          aria-labelledby="members-heading"
          className="grid content-start gap-3"
        >
          <h2 id="members-heading" className="text-lg font-semibold">
            Members
          </h2>
          <MemberList
            members={team.members}
            currentUserId={user.id}
            canRemove={isLeader && settings.team_changes_open}
          />
        </section>

        <aside className="grid content-start gap-4">
          {isLeader && invite && settings.team_joining_open && (
            <Card>
              <CardContent className="pt-5">
                <InviteManager
                  teamId={team.id}
                  url={invite.url}
                  revoked={invite.revoked}
                  expired={invite.expired}
                  full={full}
                />
              </CardContent>
            </Card>
          )}

          {settings.team_changes_open && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Team actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {isLeader ? (
                  <>
                    <p className="text-xs text-muted">
                      Leaders can&apos;t leave directly. Transfer leadership to
                      another member, or dissolve the team.
                    </p>
                    <LeaderActions
                      teamId={team.id}
                      teamName={team.name}
                      otherMembers={team.members
                        .filter((m) => m.user_id !== user.id)
                        .map((m) => ({
                          user_id: m.user_id,
                          full_name: m.full_name,
                        }))}
                    />
                  </>
                ) : (
                  <div>
                    <LeaveTeamButton />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
