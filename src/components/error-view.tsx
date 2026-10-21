"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ErrorView({ reset, home = "/" }: { reset: () => void; home?: string }) {
  return (
    <div className="mx-auto grid max-w-md gap-4 py-16 text-center">
      <p className="font-mono text-sm text-destructive">error</p>
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-sm text-muted">
        An unexpected error occurred. You can try again, or head back to the start.
      </p>
      <div className="flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href={home}>Go home</Link>
        </Button>
      </div>
    </div>
  );
}
