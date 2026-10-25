"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Link2Off, Trash2, UserMinus, UserX } from "lucide-react";
import { toast } from "sonner";
import {
  adminDeleteAccountAction,
  adminDissolveTeamAction,
  adminRemoveMemberAction,
  adminResetPasswordAction,
  adminRevokeInviteAction,
} from "@/actions/admin";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyButton } from "@/components/copy-button";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GENERIC_ERROR } from "@/lib/action";

export function RemoveMemberButton({ userId, name }: { userId: string; name: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <UserMinus /> Remove from team
        </Button>
      }
      title={`Remove ${name} from their team?`}
      description="They will no longer be in any team and can create or join one again."
      confirmLabel="Remove from team"
      action={() => adminRemoveMemberAction(userId)}
    />
  );
}

export function DeleteAccountButton({ userId, username }: { userId: string; username: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <UserX /> Delete account
        </Button>
      }
      title={`Delete the account of @${username}?`}
      description="This permanently deletes their registration, profile, team membership, requests and notifications from the database. They can register again with a new account. This cannot be undone."
      confirmLabel="Delete account"
      action={() => adminDeleteAccountAction(userId)}
    />
  );
}

export function RevokeInviteButton({ teamId }: { teamId: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <Link2Off /> Revoke invite
        </Button>
      }
      title="Revoke this team's invitation link?"
      description="The current link will stop working. The team leader can create a new one."
      confirmLabel="Revoke link"
      action={() => adminRevokeInviteAction(teamId)}
    />
  );
}

export function DissolveTeamButton({
  teamId,
  name,
  redirectTo,
}: {
  teamId: string;
  name: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="destructive" size="sm">
          <Trash2 /> Dissolve
        </Button>
      }
      title={`Dissolve “${name}”?`}
      description="This permanently deletes the team and removes all of its members. This cannot be undone."
      confirmLabel="Dissolve team"
      action={async () => {
        const result = await adminDissolveTeamAction(teamId);
        if (result.ok && redirectTo) router.push(redirectTo);
        return result;
      }}
    />
  );
}

export function ResetPasswordButton({ userId, username }: { userId: string; username: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    startTransition(async () => {
      try {
        const result = await adminResetPasswordAction(userId);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setPassword(result.data?.password ?? null);
      } catch {
        toast.error(GENERIC_ERROR);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) setPassword(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <KeyRound /> Reset password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for @{username}?</DialogTitle>
          <DialogDescription>
            A one-time temporary password is generated. The participant must choose a new password
            the next time they log in.
          </DialogDescription>
        </DialogHeader>
        {password ? (
          <div className="grid gap-3">
            <Alert variant="success">
              Temporary password created. It is shown only once, so copy it now and share it
              privately.
            </Alert>
            <code className="rounded-md border border-border bg-background px-3 py-2 font-mono text-sm">
              {password}
            </code>
            <CopyButton value={password} label="Copy password" />
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              {password ? "Done" : "Cancel"}
            </Button>
          </DialogClose>
          {!password && (
            <Button onClick={reset} loading={pending}>
              Generate temporary password
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
