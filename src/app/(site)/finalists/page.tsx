import type { Metadata } from "next";
import { Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { eventConfig } from "@/config/event";
import { getFinalists, type PublicFinalist } from "@/lib/finalists";

export const metadata: Metadata = {
  title: "Finalists",
  description: `Finalist and winning teams of ${eventConfig.name}.`,
};

// Always fresh: admins update awards on the day of the event.
export const dynamic = "force-dynamic";

function TeamCard({ team, highlight }: { team: PublicFinalist; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="break-words text-xl">{team.name}</CardTitle>
          {team.award && (
            <Badge variant="success" className="shrink-0">
              <Trophy className="size-3" aria-hidden /> {team.award}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm text-muted">{team.description}</p>
        {team.members.length > 0 && (
          <p className="flex items-start gap-2 text-sm">
            <Users className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <span>{team.members.join(", ")}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default async function FinalistsPage() {
  const finalists = await getFinalists();
  const winners = finalists.filter((t) => t.award);
  const others = finalists.filter((t) => !t.award);

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

      {finalists.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
          Finalists have not been announced yet. Check back soon.
        </div>
      ) : (
        <>
          {winners.length > 0 && (
            <section aria-labelledby="winners-heading" className="grid gap-4">
              <h2 id="winners-heading" className="flex items-center gap-2 text-2xl font-semibold">
                <Trophy className="size-6 text-primary" aria-hidden /> Winners
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {winners.map((team) => (
                  <TeamCard key={team.name} team={team} highlight />
                ))}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section aria-labelledby="finalists-heading" className="grid gap-4">
              <h2 id="finalists-heading" className="text-2xl font-semibold">
                {winners.length > 0 ? "All finalists" : "Finalist teams"}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {others.map((team) => (
                  <TeamCard key={team.name} team={team} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
