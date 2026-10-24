import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { LinkedInLink } from "@/components/linkedin-link";
import { AnswerButtons, CancelRequestButton } from "@/components/teams/match-actions";
import { RequestStatusBadge } from "@/components/teams/request-status";
import { Card } from "@/components/ui/card";
import { requireCompleteProfile } from "@/lib/auth";
import { getMatchingState, type RequestStatus } from "@/lib/matching";
import { linkedinHref } from "@/lib/links";
import { githubUrl } from "@/lib/teams";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Requests & Invitations", robots: { index: false } };

function Section({
  id,
  title,
  description,
  empty,
  children,
  count,
}: {
  id: string;
  title: string;
  description?: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <div>
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {count === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
          {empty}
        </div>
      ) : (
        <ul className="grid gap-2">{children}</ul>
      )}
    </section>
  );
}

function Row({
  title,
  detail,
  status,
  created,
  responded,
  children,
}: {
  title: React.ReactNode;
  detail?: React.ReactNode;
  status: RequestStatus;
  created: string;
  responded: string | null;
  children?: React.ReactNode;
}) {
  return (
    <li>
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="break-words">{title}</span>
            <RequestStatusBadge status={status} />
          </p>
          {detail && <p className="mt-0.5 text-sm text-muted">{detail}</p>}
          <p className="mt-0.5 text-xs text-muted">
            Sent {formatDate(created)}
            {responded && status !== "pending" ? ` · Updated ${formatDate(responded)}` : ""}
          </p>
        </div>
        {status === "pending" && children}
      </Card>
    </li>
  );
}

export default async function RequestsPage() {
  await requireCompleteProfile("/teams/requests");
  const state = await getMatchingState();
  const isLeader = Boolean(state.team?.is_leader);

  return (
    <div className="grid gap-8">
      {state.team && (
        <p className="text-sm text-muted">
          You are on{" "}
          <Link href={`/team/${state.team.id}`} className="text-primary hover:underline">
            {state.team.name}
          </Link>
          {isLeader ? ", as team leader." : "."}
        </p>
      )}

      {isLeader && state.incoming_requests && (
        <Section
          id="incoming-heading"
          title="Requests to join your team"
          description="Participants who asked to join. Accepting adds them immediately, as long as there is room."
          empty="No one has asked to join your team yet."
          count={state.incoming_requests.length}
        >
          {state.incoming_requests.map((r) => (
            <Row
              key={r.id}
              title={r.user_name}
              detail={
                r.github_username || linkedinHref(r.linkedin_url) ? (
                  <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
                    {r.github_username && (
                      <a
                        href={githubUrl(r.github_username)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
                      >
                        @{r.github_username}
                        <ExternalLink className="size-3" aria-hidden />
                        <span className="sr-only">GitHub profile (opens in a new tab)</span>
                      </a>
                    )}
                    <LinkedInLink url={r.linkedin_url} srLabel={`${r.user_name} on LinkedIn`} />
                  </span>
                ) : undefined
              }
              status={r.status}
              created={r.created_at}
              responded={r.responded_at}
            >
              <AnswerButtons requestId={r.id} who={r.user_name} kind="request" />
            </Row>
          ))}
        </Section>
      )}

      <Section
        id="invitations-heading"
        title="Invitations for you"
        description="Team leaders who invited you. You can only be on one team, so accepting one cancels your other open requests."
        empty="No invitations yet. List yourself under Looking for a Team so leaders can find you."
        count={state.received_invitations.length}
      >
        {state.received_invitations.map((r) => (
          <Row
            key={r.id}
            title={r.team_name}
            detail={
              <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>
                  Led by {r.leader_name} · {r.member_count}/{r.max_members} members
                </span>
                <LinkedInLink
                  url={r.leader_linkedin_url}
                  srLabel={`${r.leader_name} (team leader) on LinkedIn`}
                />
              </span>
            }
            status={r.status}
            created={r.created_at}
            responded={r.responded_at}
          >
            <AnswerButtons requestId={r.id} who={r.team_name} kind="invitation" />
          </Row>
        ))}
      </Section>

      <Section
        id="sent-heading"
        title="Your join requests"
        description="Teams you asked to join."
        empty="You have not asked to join any team. Browse teams to send a request."
        count={state.sent_requests.length}
      >
        {state.sent_requests.map((r) => (
          <Row
            key={r.id}
            title={r.team_name}
            status={r.status}
            created={r.created_at}
            responded={r.responded_at}
          >
            <CancelRequestButton requestId={r.id} />
          </Row>
        ))}
      </Section>

      {isLeader && state.sent_invitations && (
        <Section
          id="sent-invitations-heading"
          title="Invitations you sent"
          description="Participants your team invited."
          empty="You have not invited anyone yet. Find people under Looking for a Team."
          count={state.sent_invitations.length}
        >
          {state.sent_invitations.map((r) => (
            <Row
              key={r.id}
              title={r.user_name}
              detail={
                <LinkedInLink url={r.linkedin_url} srLabel={`${r.user_name} on LinkedIn`} />
              }
              status={r.status}
              created={r.created_at}
              responded={r.responded_at}
            >
              <CancelRequestButton
                requestId={r.id}
                label="Cancel invitation"
                title={`Cancel the invitation to ${r.user_name}?`}
              />
            </Row>
          ))}
        </Section>
      )}
    </div>
  );
}
