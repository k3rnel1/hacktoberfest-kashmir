"use client";

import { Check, Send, UserPlus, X } from "lucide-react";
import {
  cancelRequestAction,
  requestToJoinAction,
  respondToRequestAction,
  sendInvitationAction,
  withdrawListingAction,
} from "@/actions/matching";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";

// Thin client wrappers: each opens a confirmation dialog, calls a server action and
// refreshes the page. The server re-checks permission, eligibility and capacity.

export function RequestToJoinButton({ teamId, teamName }: { teamId: string; teamName: string }) {
  return (
    <ConfirmDialog
      destructive={false}
      trigger={
        <Button size="sm">
          <UserPlus /> Request to Join
        </Button>
      }
      title={`Request to join “${teamName}”?`}
      description="The team leader will see your request and can accept or decline it. You can cancel it any time while it is pending."
      confirmLabel="Send request"
      action={() => requestToJoinAction(teamId)}
    />
  );
}

export function CancelRequestButton({
  requestId,
  label = "Cancel request",
  title = "Cancel this request?",
  description = "It will be withdrawn and the other person will no longer see it as pending.",
}: {
  requestId: string;
  label?: string;
  title?: string;
  description?: string;
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <X /> {label}
        </Button>
      }
      title={title}
      description={description}
      confirmLabel="Yes, cancel"
      action={() => cancelRequestAction(requestId)}
    />
  );
}

export function AnswerButtons({
  requestId,
  who,
  kind,
}: {
  requestId: string;
  who: string;
  kind: "request" | "invitation";
}) {
  const acceptText =
    kind === "request"
      ? `${who} will join your team immediately.`
      : `You will join ${who} and leave the Looking for a Team list. Your other pending requests and invitations will be cancelled.`;
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmDialog
        destructive={false}
        trigger={
          <Button size="sm">
            <Check /> Accept
          </Button>
        }
        title={kind === "request" ? `Accept ${who}?` : `Join ${who}?`}
        description={acceptText}
        confirmLabel="Accept"
        action={() => respondToRequestAction(requestId, true)}
      />
      <ConfirmDialog
        trigger={
          <Button variant="outline" size="sm">
            <X /> Decline
          </Button>
        }
        title={kind === "request" ? `Decline ${who}?` : `Decline the invitation from ${who}?`}
        description="The other person will see the request as rejected."
        confirmLabel="Decline"
        action={() => respondToRequestAction(requestId, false)}
      />
    </div>
  );
}

export function SendInvitationButton({
  participantId,
  name,
  disabled,
}: {
  participantId: string;
  name: string;
  disabled?: boolean;
}) {
  return (
    <ConfirmDialog
      destructive={false}
      trigger={
        <Button size="sm" disabled={disabled}>
          <Send /> Send Join Request
        </Button>
      }
      title={`Invite ${name} to your team?`}
      description="They will see the invitation in their Requests tab and can accept or decline. Your team's capacity is checked again when they accept."
      confirmLabel="Send invitation"
      action={() => sendInvitationAction(participantId)}
    />
  );
}

export function WithdrawListingButton() {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          Withdraw listing
        </Button>
      }
      title="Remove your listing?"
      description="Team leaders will no longer see you in the Looking for a Team directory. Invitations already sent to you stay open."
      confirmLabel="Remove listing"
      action={() => withdrawListingAction()}
    />
  );
}
