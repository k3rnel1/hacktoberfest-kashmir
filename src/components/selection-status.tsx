import { Badge } from "@/components/ui/badge";
import {
  SELECTION_LABELS,
  SELECTION_MESSAGES,
  type SelectionStatus,
} from "@/lib/selection";

const VARIANT = {
  in_process: "default",
  selected: "success",
  on_hold: "warning",
  rejected: "destructive",
} as const satisfies Record<SelectionStatus, "default" | "success" | "warning" | "destructive">;

export function SelectionBadge({ status }: { status: SelectionStatus }) {
  return <Badge variant={VARIANT[status]}>{SELECTION_LABELS[status]}</Badge>;
}

// Participant-facing banner: current status plus a short explanation.
export function SelectionStatusCard({ status }: { status: SelectionStatus }) {
  return (
    <section
      aria-labelledby="selection-heading"
      className="rounded-lg border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="selection-heading" className="text-sm font-medium text-muted">
          Selection status
        </h2>
        <SelectionBadge status={status} />
      </div>
      <p className="mt-2 text-sm" role="status">
        {SELECTION_MESSAGES[status]}
      </p>
    </section>
  );
}
