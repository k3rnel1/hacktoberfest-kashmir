import type { Metadata } from "next";
import { FinalistsList } from "@/components/finalists-list";
import { Badge } from "@/components/ui/badge";
import { eventConfig } from "@/config/event";
import { getFinalists } from "@/lib/finalists";

export const metadata: Metadata = {
  title: "Finalists",
  description: `Finalist and winning teams of ${eventConfig.name}.`,
};

// Always fresh: admins update awards on the day of the event.
export const dynamic = "force-dynamic";

export default async function FinalistsPage() {
  const finalists = await getFinalists();

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
      <FinalistsList finalists={finalists} />
    </div>
  );
}
