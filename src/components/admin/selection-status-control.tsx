"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { adminSetTeamStatusAction } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { GENERIC_ERROR } from "@/lib/action";
import { SELECTION_LABELS, SELECTION_STATUSES, type SelectionStatus } from "@/lib/selection";

export function SelectionStatusControl({
  teamId,
  current,
}: {
  teamId: string;
  current: SelectionStatus;
}) {
  const [value, setValue] = useState<SelectionStatus>(current);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      try {
        const result = await adminSetTeamStatusAction(teamId, value);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        if (result.message) toast.success(result.message);
        router.refresh();
      } catch {
        toast.error(GENERIC_ERROR);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="selection-status" className="sr-only">
        Selection status
      </label>
      <select
        id="selection-status"
        value={value}
        onChange={(e) => setValue(e.target.value as SelectionStatus)}
        disabled={pending}
        className="h-10 rounded-md border border-border bg-surface px-2 text-sm"
      >
        {SELECTION_STATUSES.map((s) => (
          <option key={s} value={s}>
            {SELECTION_LABELS[s]}
          </option>
        ))}
      </select>
      <Button size="sm" onClick={save} loading={pending} disabled={value === current}>
        Update status
      </Button>
    </div>
  );
}
