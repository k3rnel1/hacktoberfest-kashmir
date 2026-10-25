import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FinalistsList } from "@/components/finalists-list";
import { requireCompleteProfile } from "@/lib/auth";
import { FinalistsLocked } from "@/components/finalists-locked";
import { getFinalists, getFinalistsAccess } from "@/lib/finalists";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Finalists", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TeamsFinalistsPage() {
  await requireCompleteProfile("/teams/finalists");
  const settings = await getSettings();
  if (!settings.finalists_visible) notFound();
  const access = await getFinalistsAccess();
  const visible = access === "ok";
  const finalists = visible ? await getFinalists() : [];

  return (
    <div className="grid gap-6">
      <p className="max-w-2xl text-sm text-muted">
        The teams that made it to the final round, and the ones taking home awards.
      </p>
      {access !== "ok" ? (
        <FinalistsLocked reason={access} next="/teams/finalists" loginOpen={settings.participant_login_open} />
      ) : visible ? (
        <FinalistsList finalists={finalists} />
      ) : (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted">
          Finalists will be announced soon.
        </p>
      )}
    </div>
  );
}
