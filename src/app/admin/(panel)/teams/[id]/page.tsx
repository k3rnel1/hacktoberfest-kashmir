import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  DissolveTeamButton,
  RemoveMemberButton,
  RevokeInviteButton,
} from "@/components/admin/admin-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { getTeam } from "@/lib/admin-data";
import { githubUrl } from "@/lib/teams";
import { formatDate } from "@/lib/utils";
import { uuidSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Team · Admin" };

export default async function AdminTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const team = await getTeam(id);
  if (!team) notFound();

  return (
    <div className="grid gap-6">
      <Link href="/admin/teams" className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" /> All teams
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-3xl font-semibold tracking-tight">{team.name}</h1>
          <p className="mt-2 max-w-2xl text-muted">{team.description}</p>
          <p className="mt-2 font-mono text-xs text-muted">{team.id}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!team.invite_revoked && <RevokeInviteButton teamId={team.id} />}
          <DissolveTeamButton teamId={team.id} name={team.name} redirectTo="/admin/teams" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted">Members</p>
          <p className="mt-1 font-mono text-xl">
            {team.members.length}/{team.max_members}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Invitation link</p>
          <p className="mt-1">
            {team.invite_revoked ? (
              <Badge variant="destructive">Revoked</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Created</p>
          <p className="mt-1">{formatDate(team.created_at)}</p>
        </Card>
      </div>

      <section className="grid gap-3" aria-labelledby="members-heading">
        <h2 id="members-heading" className="text-lg font-semibold">
          Members
        </h2>
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Username</TH>
              <TH>Role</TH>
              <TH>Mobile</TH>
              <TH>Gmail</TH>
              <TH>GitHub</TH>
              <TH>LinkedIn</TH>
              <TH>Joined</TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {team.members.map((m) => (
              <tr key={m.user_id}>
                <TD className="font-medium">{m.full_name ?? "—"}</TD>
                <TD className="font-mono text-xs">@{m.username}</TD>
                <TD>
                  <Badge variant={m.role === "leader" ? "primary" : "default"}>{m.role}</Badge>
                </TD>
                <TD className="font-mono text-xs">{m.mobile_number ?? "—"}</TD>
                <TD className="text-xs">{m.gmail ?? "—"}</TD>
                <TD>
                  {m.github_username ? (
                    <a
                      href={githubUrl(m.github_username)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      @{m.github_username}
                    </a>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD>
                  {m.linkedin_url ? (
                    <a
                      href={m.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Profile
                    </a>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD className="whitespace-nowrap text-muted">{formatDate(m.joined_at)}</TD>
                <TD>
                  {m.role === "member" && (
                    <RemoveMemberButton userId={m.user_id} name={m.full_name ?? m.username} />
                  )}
                </TD>
              </tr>
            ))}
          </TBody>
        </Table>
      </section>
    </div>
  );
}
