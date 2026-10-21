"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INVITE_TOKEN_PATTERN } from "@/lib/validation";

export function PasteInvite() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("invite") ?? "").trim();
    const token = value.split("/join/").pop()?.split(/[?#]/)[0] ?? "";
    if (!INVITE_TOKEN_PATTERN.test(token)) {
      setError("That doesn't look like a valid invitation link.");
      return;
    }
    setError(null);
    router.push(`/join/${token}`);
  }

  return (
    <form onSubmit={submit} className="grid gap-2" noValidate>
      <Label htmlFor="invite">Invitation link</Label>
      <div className="flex gap-2">
        <Input
          id="invite"
          name="invite"
          placeholder="Paste the link your leader shared"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "invite-error" : undefined}
        />
        <Button type="submit" variant="secondary">
          Open
        </Button>
      </div>
      {error && (
        <p id="invite-error" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
