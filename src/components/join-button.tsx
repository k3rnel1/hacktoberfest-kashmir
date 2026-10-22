"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { joinTeamAction } from "@/actions/teams";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { GENERIC_ERROR } from "@/lib/action";

export function JoinButton({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function join() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await joinTeamAction(token);
        if (result && !result.ok) setError(result.error);
      } catch (error) {
        // A server action that calls redirect() rejects with a redirect signal. Let
        // Next handle the navigation instead of showing an error message.
        unstable_rethrow(error);
        setError(GENERIC_ERROR);
      }
    });
  }

  return (
    <div className="grid gap-3">
      {error && <Alert variant="error">{error}</Alert>}
      <Button onClick={join} loading={pending} size="lg">
        Join team
      </Button>
    </div>
  );
}
