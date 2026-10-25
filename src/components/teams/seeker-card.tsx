import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkedInLink } from "@/components/linkedin-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { linkedinHref } from "@/lib/links";
import type { Seeker } from "@/lib/matching";
import { githubUrl } from "@/lib/teams";
import { SendInvitationButton } from "./match-actions";
import { RequestStatusBadge } from "./request-status";

export function SeekerCard({
  seeker,
  canInvite,
  inviteBlockedReason,
}: {
  seeker: Seeker;
  canInvite: boolean;
  inviteBlockedReason?: string;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="break-words text-xl">{seeker.name}</CardTitle>
          <Badge variant="success">Available</Badge>
        </div>
        {seeker.preferred_role && (
          <p className="text-sm text-muted">Prefers: {seeker.preferred_role}</p>
        )}
      </CardHeader>
      <CardContent className="mt-auto grid gap-3">
        {seeker.skills.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-muted">Skills</p>
            <ul className="flex flex-wrap gap-1.5">
              {seeker.skills.map((s) => (
                <li key={s}>
                  <Badge variant="primary">{s}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
        {seeker.interests.length > 0 && (
          <div>
            <p className="mb-1 text-xs text-muted">Interests</p>
            <ul className="flex flex-wrap gap-1.5">
              {seeker.interests.map((s) => (
                <li key={s}>
                  <Badge>{s}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
        {seeker.intro && <p className="whitespace-pre-line break-words text-sm">{seeker.intro}</p>}

        {(seeker.github_username || seeker.portfolio_url || linkedinHref(seeker.linkedin_url)) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <LinkedInLink url={seeker.linkedin_url} srLabel={`${seeker.name} on LinkedIn`} />
            {seeker.github_username && (
              <a
                href={githubUrl(seeker.github_username)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
              >
                @{seeker.github_username}
                <ExternalLink className="size-3" aria-hidden />
                <span className="sr-only">GitHub profile (opens in a new tab)</span>
              </a>
            )}
            {seeker.portfolio_url && (
              <a
                href={seeker.portfolio_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Portfolio
                <ExternalLink className="size-3" aria-hidden />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </div>
        )}

        {seeker.is_me ? (
          <Badge className="w-fit">This is you</Badge>
        ) : seeker.invited ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <RequestStatusBadge status="pending" /> Invitation sent
          </div>
        ) : canInvite ? (
          <div>
            <SendInvitationButton participantId={seeker.user_id} name={seeker.name} />
          </div>
        ) : inviteBlockedReason ? (
          <p className="text-xs text-muted">{inviteBlockedReason}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
