import type { Metadata } from "next";
import { FinalistsList } from "@/components/finalists-list";
import { requireCompleteProfile } from "@/lib/auth";
import { getFinalists } from "@/lib/finalists";

export const metadata: Metadata = { title: "Finalists", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TeamsFinalistsPage() {
  await requireCompleteProfile("/teams/finalists");
  const finalists = await getFinalists();

  return (
    <div className="grid gap-6">
      <p className="max-w-2xl text-sm text-muted">
        The teams that made it to the final round, and the ones taking home awards.
      </p>
      <FinalistsList finalists={finalists} />
    </div>
  );
}
