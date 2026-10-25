import { Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicFinalist } from "@/lib/finalists";

// Shared by the public /finalists page and the Finalists tab inside Teams.

function FinalistCard({ team, highlight }: { team: PublicFinalist; highlight?: boolean }) {
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

export function FinalistsList({ finalists }: { finalists: PublicFinalist[] }) {
  const winners = finalists.filter((t) => t.award);
  const others = finalists.filter((t) => !t.award);

  if (finalists.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
        Finalists have not been announced yet. Check back soon.
      </div>
    );
  }

  return (
    <div className="grid gap-10">
      {winners.length > 0 && (
        <section aria-labelledby="winners-heading" className="grid gap-4">
          <h2 id="winners-heading" className="flex items-center gap-2 text-2xl font-semibold">
            <Trophy className="size-6 text-primary" aria-hidden /> Winners
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {winners.map((team) => (
              <FinalistCard key={team.name} team={team} highlight />
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
              <FinalistCard key={team.name} team={team} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
