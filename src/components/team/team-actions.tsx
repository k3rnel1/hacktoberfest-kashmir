"use client";

import { useState } from "react";
import { Crown, LogOut, Trash2, UserMinus } from "lucide-react";
import {
  dissolveTeamAction,
  kickMemberAction,
  leaveTeamAction,
  transferLeadershipAction,
} from "@/actions/teams";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function LeaveTeamButton() {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <LogOut /> Leave team
        </Button>
      }
      title="Leave this team?"
      description="You will be removed from the team. You can join a team again later with an invitation link."
      confirmLabel="Leave team"
      action={leaveTeamAction}
    />
  );
}

export function KickMemberButton({ userId, name }: { userId: string; name: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm" className="text-destructive">
          <UserMinus /> Remove
          <span className="sr-only"> {name} from the team</span>
        </Button>
      }
      title={`Remove ${name} from your team?`}
      description={`${name} will be taken off the team and notified. They will not be able to rejoin with your invitation link or by sending a request, but you can still invite them directly later.`}
      confirmLabel="Remove member"
      action={() => kickMemberAction(userId)}
    />
  );
}

export function LeaderActions({
  teamId,
  teamName,
  otherMembers,
}: {
  teamId: string;
  teamName: string;
  otherMembers: { user_id: string; full_name: string | null }[];
}) {
  const [target, setTarget] = useState(otherMembers[0]?.user_id ?? "");

  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmDialog
        trigger={
          <Button variant="outline" size="sm" disabled={otherMembers.length === 0}>
            <Crown /> Transfer leadership
          </Button>
        }
        title="Transfer leadership"
        description="The selected member becomes the team leader and you become a regular member. Only the new leader can manage invitations."
        confirmLabel="Transfer"
        destructive={false}
        action={() => transferLeadershipAction(target)}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="new-leader">New leader</Label>
          <select
            id="new-leader"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          >
            {otherMembers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name ?? "Unnamed member"}
              </option>
            ))}
          </select>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        trigger={
          <Button variant="destructive" size="sm">
            <Trash2 /> Dissolve team
          </Button>
        }
        title={`Dissolve “${teamName}”?`}
        description="This permanently deletes the team and removes every member from it. This cannot be undone."
        confirmLabel="Dissolve team"
        action={() => dissolveTeamAction(teamId)}
      />
    </div>
  );
}
