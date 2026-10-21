"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2Off, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { revokeInviteAction, rotateInviteAction } from "@/actions/teams";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CopyButton } from "@/components/copy-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GENERIC_ERROR } from "@/lib/action";

export function InviteManager({
  teamId,
  url: initialUrl,
  revoked,
  expired,
  full,
}: {
  teamId: string;
  url: string;
  revoked: boolean;
  expired: boolean;
  full: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [isRevoked, setIsRevoked] = useState(revoked);
  const [pending, startTransition] = useTransition();

  const active = !isRevoked && !expired;

  function regenerate() {
    startTransition(async () => {
      try {
        const result = await rotateInviteAction(teamId);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (result.data?.url) setUrl(result.data.url);
        setIsRevoked(false);
        toast.success(result.message ?? "New invitation link created.");
        router.refresh();
      } catch {
        toast.error(GENERIC_ERROR);
      }
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <h3 className="font-medium">Invitation link</h3>
        {active ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="destructive">{isRevoked ? "Revoked" : "Expired"}</Badge>
        )}
      </div>

      {active ? (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={url} aria-label="Invitation link" className="font-mono text-xs" />
            <CopyButton value={url} label="Copy link" />
          </div>
          {full && <Alert variant="info">The team is full. New members can&apos;t join until a spot opens.</Alert>}
        </>
      ) : (
        <Alert variant="info">
          This link no longer works. Generate a new one to invite more teammates.
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={regenerate} loading={pending}>
          <RefreshCw /> {active ? "Regenerate link" : "Create new link"}
        </Button>
        {active && (
          <ConfirmDialog
            trigger={
              <Button variant="outline" size="sm">
                <Link2Off /> Revoke link
              </Button>
            }
            title="Revoke invitation link?"
            description="Anyone using the current link will see that it has been revoked. You can create a new link at any time."
            confirmLabel="Revoke link"
            action={async () => {
              const result = await revokeInviteAction(teamId);
              if (result.ok) setIsRevoked(true);
              return result;
            }}
          />
        )}
      </div>
      <p className="text-xs text-muted">
        Regenerating replaces the old link, so previously shared links stop working.
      </p>
    </div>
  );
}
