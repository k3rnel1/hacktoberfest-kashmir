import { Crown, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkedInLink } from "@/components/linkedin-link";
import { KickMemberButton } from "@/components/team/team-actions";
import { githubUrl, type TeamMember } from "@/lib/teams";
import { initials } from "@/lib/utils";

export function MemberList({
  members,
  currentUserId,
  canRemove = false,
}: {
  members: TeamMember[];
  currentUserId: string;
  // True only for the team leader: shows a Remove button next to every other member.
  // The database re-checks that the caller leads this team.
  canRemove?: boolean;
}) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {members.map((member) => (
        <li key={member.user_id} className="flex flex-wrap items-center gap-3 p-3">
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-xs font-semibold"
          >
            {initials(member.full_name ?? "?")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {member.full_name ?? "Unnamed member"}
              {member.role === "leader" && (
                <Badge variant="primary">
                  <Crown className="size-3" /> Leader
                </Badge>
              )}
              {member.user_id === currentUserId && <Badge>You</Badge>}
            </p>
            <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {member.github_username && (
                <a
                  href={githubUrl(member.github_username)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono hover:text-primary"
                >
                  @{member.github_username}
                  <ExternalLink className="size-3" aria-hidden />
                  <span className="sr-only">GitHub profile (opens in a new tab)</span>
                </a>
              )}
              <LinkedInLink
                url={member.linkedin_url}
                className="text-muted hover:text-primary hover:no-underline"
              />
            </div>
          </div>
          {canRemove && member.role !== "leader" && member.user_id !== currentUserId && (
            <KickMemberButton userId={member.user_id} name={member.full_name ?? "this member"} />
          )}
        </li>
      ))}
    </ul>
  );
}
