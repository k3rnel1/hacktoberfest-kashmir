import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AuthCard } from "@/components/forms/auth-card";
import { CreateTeamForm } from "@/components/forms/create-team-form";
import { requireCompleteProfile } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getMyTeamId } from "@/lib/teams";

export const metadata: Metadata = { title: "Create a team" };

export default async function CreateTeamPage() {
  // Switched off: the page does not exist.
  if (!(await getSettings()).team_creation_open) notFound();

  const { user } = await requireCompleteProfile("/create-team");
  const existing = await getMyTeamId(user.id);
  if (existing) redirect(`/team/${existing}`);

  return (
    <AuthCard
      title="Create a team"
      description="You'll become the team leader and get an invitation link to share with friends."
    >
      <CreateTeamForm />
    </AuthCard>
  );
}
