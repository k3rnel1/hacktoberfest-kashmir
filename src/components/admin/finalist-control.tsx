"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminSetFinalistAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GENERIC_ERROR } from "@/lib/action";

export function FinalistControl({
  teamId,
  isFinalist,
  award,
  awardRank,
  canBeFinalist,
}: {
  teamId: string;
  isFinalist: boolean;
  award: string | null;
  awardRank: number | null;
  canBeFinalist: boolean;
}) {
  const [finalist, setFinalist] = useState(isFinalist);
  const [awardText, setAwardText] = useState(award ?? "");
  const [rank, setRank] = useState(awardRank?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      try {
        const result = await adminSetFinalistAction(teamId, { finalist, award: awardText, rank });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (result.message) toast.success(result.message);
        router.refresh();
      } catch (error) {
        unstable_rethrow(error);
        toast.error(GENERIC_ERROR);
      }
    });
  }

  const unavailable = !canBeFinalist && !isFinalist;

  return (
    <div className="grid gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={finalist}
          disabled={pending || unavailable}
          onChange={(e) => setFinalist(e.target.checked)}
          className="size-4 accent-[var(--color-primary)]"
        />
        Show this team on the public Finalists page
      </label>
      {unavailable && (
        <p className="text-xs text-muted">Set the team&apos;s selection status to Selected first.</p>
      )}

      {finalist && (
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Award (optional, for example &ldquo;Winner&rdquo;)</span>
            <Input
              value={awardText}
              onChange={(e) => setAwardText(e.target.value)}
              maxLength={60}
              disabled={pending}
              placeholder="Winner, 1st Runner-up, Best Use of AI…"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted">Order</span>
            <Input
              type="number"
              min={1}
              max={99}
              value={rank}
              onChange={(e) => setRank(e.target.value)}
              disabled={pending}
              placeholder="1"
            />
          </label>
        </div>
      )}

      <div>
        <Button size="sm" onClick={save} loading={pending} disabled={unavailable}>
          Save finalist details
        </Button>
      </div>
    </div>
  );
}
