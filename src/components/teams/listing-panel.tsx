"use client";

import { useState } from "react";
import { Pencil, Search } from "lucide-react";
import { saveListingAction } from "@/actions/matching";
import Link from "next/link";
import { FormError, TextAreaField, TextField } from "@/components/forms/field";
import { useActionForm } from "@/components/forms/use-action-form";
import { LinkedInLink } from "@/components/linkedin-link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MatchingState } from "@/lib/matching";
import { listingSchema } from "@/lib/matching-schema";
import { formatDate } from "@/lib/utils";
import { WithdrawListingButton } from "./match-actions";

function ListingForm({
  listing,
  onDone,
}: {
  listing: MatchingState["listing"];
  onDone: () => void;
}) {
  const { onSubmit, errors, formError, pending } = useActionForm(listingSchema, async (fd) => {
    const result = await saveListingAction(fd);
    if (result.ok) onDone();
    return result;
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormError message={formError} />
      <TextField
        label="Skills and technologies"
        name="skills"
        required
        maxLength={400}
        defaultValue={listing?.skills.join(", ") ?? ""}
        hint="Separate with commas, for example: React, Python, Figma. Up to 10."
        error={errors.skills}
      />
      <TextField
        label="Areas of interest"
        name="interests"
        maxLength={400}
        defaultValue={listing?.interests.join(", ") ?? ""}
        hint="For example: open-source AI, web apps, design. Up to 10."
        error={errors.interests}
      />
      <TextAreaField
        label="Short introduction"
        name="intro"
        rows={3}
        maxLength={300}
        defaultValue={listing?.intro ?? ""}
        hint="What would you like to build or contribute? Up to 300 characters."
        error={errors.intro}
      />
      <TextField
        label="Preferred role (optional)"
        name="preferredRole"
        maxLength={40}
        defaultValue={listing?.preferred_role ?? ""}
        hint="For example: Frontend, ML engineer, Designer."
        error={errors.preferredRole}
      />
      <TextField
        label="Portfolio link (optional)"
        name="portfolioUrl"
        type="url"
        maxLength={200}
        defaultValue={listing?.portfolio_url ?? ""}
        hint="Must start with https://. Your GitHub from your profile is shown automatically."
        error={errors.portfolioUrl}
      />
      <p className="text-xs text-muted">
        Your name, GitHub username and LinkedIn profile come from your profile and are shown on
        your listing so team leaders can contact you. Your phone number and email are never shown
        here.
      </p>
      <Button type="submit" loading={pending}>
        {listing ? "Save changes" : "List me as looking for a team"}
      </Button>
    </form>
  );
}

export function ListingPanel({
  state,
  linkedinUrl,
}: {
  state: MatchingState;
  // The viewer's own LinkedIn URL from their profile (shown on their listing).
  linkedinUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { team, listing } = state;

  if (team) {
    return (
      <Alert variant="info">
        You are on <strong>{team.name}</strong>, so you do not appear in the Looking for a Team
        list.
        {team.is_leader
          ? " As the team leader you can invite listed participants below."
          : " Only your team leader can invite participants."}
      </Alert>
    );
  }

  return (
    <Card className="grid gap-4 p-5">
      {listing ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Your listing</h2>
            <Badge variant="success">Active</Badge>
          </div>
          <p className="text-sm text-muted">
            Team leaders can see this and invite you. Updated {formatDate(listing.updated_at)}. You
            are removed automatically when you join a team.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {listing.skills.map((s) => (
              <Badge key={s} variant="primary">
                {s}
              </Badge>
            ))}
            {listing.interests.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
          {listing.intro && <p className="whitespace-pre-line text-sm">{listing.intro}</p>}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            LinkedIn shown on your listing:
            {linkedinUrl ? (
              <LinkedInLink url={linkedinUrl} label="Your LinkedIn profile" />
            ) : (
              <span>none</span>
            )}
            <span aria-hidden>·</span>
            <Link href="/settings/profile" className="text-primary hover:underline">
              Change in profile
            </Link>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Pencil /> Edit listing
            </Button>
            <WithdrawListingButton />
          </div>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold">Find teammates</h2>
          <p className="text-sm text-muted">
            Not on a team yet? List your skills and interests so team leaders can find you and send
            you an invitation. You can edit or remove your listing at any time.
          </p>
          <div>
            <Button onClick={() => setOpen(true)}>
              <Search /> I&apos;m Looking for a Team
            </Button>
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{listing ? "Edit your listing" : "I'm Looking for a Team"}</DialogTitle>
            <DialogDescription>
              Only what you write here, plus your name, GitHub and LinkedIn from your profile, is
              shown to team leaders and other participants.
            </DialogDescription>
          </DialogHeader>
          {open && <ListingForm listing={listing} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
