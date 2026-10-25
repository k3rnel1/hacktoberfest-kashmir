import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FinalistsList } from "@/components/finalists-list";
import { Badge } from "@/components/ui/badge";
import { eventConfig } from "@/config/event";
import { FinalistsLocked } from "@/components/finalists-locked";
import { getFinalists, getFinalistsAccess } from "@/lib/finalists";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Finalists",
  description: `Finalist and winning teams of ${eventConfig.name}.`,
};

// Always fresh: admins update awards on the day of the event.
export const dynamic = "force-dynamic";

export default async function FinalistsPage() {
  const settings = await getSettings();
  if (!settings.finalists_visible) notFound();
  const access = await getFinalistsAccess();
  const visible = access === "ok";
  const finalists = visible ? await getFinalists() : [];

  return (
    <div className="grid gap-10">
      <div>
        <Badge variant="primary" className="mb-4 font-mono">
          {eventConfig.name}
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight">Finalists</h1>
        <p className="mt-2 max-w-2xl text-muted">
          The teams that made it to the final round, and the ones taking home awards.
        </p>
      </div>
      {access !== "ok" ? (
        <FinalistsLocked reason={access} next="/finalists" loginOpen={settings.participant_login_open} />
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
