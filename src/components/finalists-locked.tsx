import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalistsLocked({
  reason,
  next,
  loginOpen = true,
}: {
  reason: "login" | "denied";
  next: string;
  loginOpen?: boolean;
}) {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-3 rounded-lg border border-dashed border-border p-10 text-center">
      <Lock className="size-6 text-muted" aria-hidden />
      <p className="font-medium">Finalists are only visible to selected teams</p>
      <p className="text-sm text-muted">
        {reason === "login"
          ? "Log in with your participant account to check whether your team has been selected."
          : "This page opens up once your team has the Selected status."}
      </p>
      {reason === "login" && !loginOpen ? null : reason === "login" ? (
        <Button asChild>
          <Link href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link>
        </Button>
      ) : (
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      )}
    </div>
  );
}
