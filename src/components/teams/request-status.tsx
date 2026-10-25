import { Badge } from "@/components/ui/badge";
import type { RequestStatus } from "@/lib/matching";

const LABELS: Record<RequestStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const VARIANTS = {
  pending: "warning",
  accepted: "success",
  rejected: "destructive",
  cancelled: "default",
} as const satisfies Record<RequestStatus, "warning" | "success" | "destructive" | "default">;

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}
