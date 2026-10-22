import { z } from "zod";

// Single source of truth for team selection statuses. The database enforces the
// same four values with a CHECK constraint (see the team_selection_status migration).

export const SELECTION_STATUSES = ["in_process", "selected", "on_hold", "rejected"] as const;
export type SelectionStatus = (typeof SELECTION_STATUSES)[number];

export const selectionStatusSchema = z.enum(SELECTION_STATUSES);

export const SELECTION_LABELS: Record<SelectionStatus, string> = {
  in_process: "In Process",
  selected: "Selected",
  on_hold: "On Hold",
  rejected: "Rejected",
};

// Shown to participants on their dashboard and team page.
export const SELECTION_MESSAGES: Record<SelectionStatus, string> = {
  in_process: "Your team is being reviewed. This page will update when a decision is made.",
  selected: "Congratulations! Your team has been selected for Hacktoberfest Kashmir.",
  on_hold: "Your team's application is on hold for now. We will update this page if that changes.",
  rejected: "Unfortunately, your team was not selected this time. Thank you for applying.",
};

export function selectionLabel(status: string | null | undefined): string {
  return status && status in SELECTION_LABELS ? SELECTION_LABELS[status as SelectionStatus] : "";
}

export function parseSelectionFilter(value: string | undefined): SelectionStatus | "all" {
  return SELECTION_STATUSES.includes(value as SelectionStatus)
    ? (value as SelectionStatus)
    : "all";
}
