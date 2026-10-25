import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Crown, Users } from "lucide-react";
import { JoinButton } from "@/components/join-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCompleteProfile } from "@/lib/auth";
import { hashInviteToken } from "@/lib/invite";
import { getSettings } from "@/lib/settings";
import { getInvitePreview, getMyTeamId } from "@/lib/teams";
import { INVITE_TOKEN_PATTERN } from "@/lib/validation";

export const metadata: Metadata = {
  title: "Team invitation",
  robots: { index: false },
  referrer: "no-referrer",
};

const MESSAGES = {
  invalid: "This invitation link is invalid or has been replaced. Ask your team leader for a new one.",
  revoked: "The team leader has revoked this invitation link. Ask them for a new one.",
  expired: "This invitation link has expired. Ask your team leader for a new one.",
  full: "This team is full, so it can't accept new members right now.",
} as const;

function Problem({ message }: { message: string }) {
  return (
    <div className="mx-auto grid w-full max-w-md gap-4">
      <Alert variant="error">{message}</Alert>
      <Button asChild variant="outline">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Switched off: invitation links open nothing.
  if (!(await getSettings()).team_joining_open) notFound();

  // Signed-out visitors are sent to log in and returned here; incomplete profiles are
  // sent to complete their profile and returned here.
  const { user } = await requireCompleteProfile(`/join/${token}`);

  if (!INVITE_TOKEN_PATTERN.test(token)) return <Problem message={MESSAGES.invalid} />;

  const preview = await getInvitePreview(hashInviteToken(token));
  if (preview.status === "invalid") return <Problem message={MESSAGES.invalid} />;

  const currentTeam = await getMyTeamId(user.id);

  return (
    <div className="mx-auto w-full max-w-md animate-fade-up">
      <Card>
        <CardHeader>
          <CardDescription className="font-mono">You&apos;ve been invited to join</CardDescription>
          <CardTitle className="text-2xl">{preview.team_name}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm text-muted">{preview.description}</p>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-border p-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <Crown className="size-3" aria-hidden /> Leader
              </dt>
              <dd className="mt-1 font-medium">{preview.leader_name ?? "—"}</dd>
            </div>
            <div className="rounded-md border border-border p-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <Users className="size-3" aria-hidden /> Members
              </dt>
              <dd className="mt-1 font-medium">
                {preview.member_count} / {preview.max_members}
              </dd>
            </div>
          </dl>

          {preview.already_member ? (
            <>
              <Alert variant="success">You are already a member of this team.</Alert>
              <Button asChild>
                <Link href={`/team/${preview.team_id}`}>Open team page</Link>
              </Button>
            </>
          ) : preview.status !== "ok" ? (
            <Alert variant="error">{MESSAGES[preview.status]}</Alert>
          ) : currentTeam ? (
            <>
              <Alert variant="info">
                You already belong to a team. Each participant can be in only one team, so you
                can&apos;t join another.
              </Alert>
              <Button asChild variant="outline">
                <Link href={`/team/${currentTeam}`}>Go to my team</Link>
              </Button>
            </>
          ) : (
            <JoinButton token={token} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
