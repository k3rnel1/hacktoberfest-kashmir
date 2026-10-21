"use client";

import { saveProfileAction } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { profileSchema } from "@/lib/validation";
import { FormError, TextField } from "./field";
import { useActionForm } from "./use-action-form";

export type ProfileDefaults = {
  fullName: string;
  mobileNumber: string;
  gmail: string;
  githubUsername: string;
  linkedinUrl: string;
};

export function ProfileForm({
  defaults,
  mode,
  next,
}: {
  defaults: ProfileDefaults;
  mode: "complete" | "edit";
  next?: string;
}) {
  const { onSubmit, errors, formError, pending } = useActionForm(profileSchema, saveProfileAction);

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <input type="hidden" name="mode" value={mode} />
      {next && <input type="hidden" name="next" value={next} />}
      <FormError message={formError} />
      <TextField
        label="Full name"
        name="fullName"
        autoComplete="name"
        defaultValue={defaults.fullName}
        required
        error={errors.fullName}
      />
      <TextField
        label="Mobile number"
        name="mobileNumber"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="9876543210"
        defaultValue={defaults.mobileNumber}
        required
        hint="Only visible to event organizers."
        error={errors.mobileNumber}
      />
      <TextField
        label="Gmail address"
        name="gmail"
        type="email"
        autoComplete="email"
        placeholder="you@gmail.com"
        defaultValue={defaults.gmail}
        required
        hint="Only visible to event organizers."
        error={errors.gmail}
      />
      <TextField
        label="GitHub username"
        name="githubUsername"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="octocat"
        defaultValue={defaults.githubUsername}
        required
        hint="Shown to your teammates, linked to your GitHub profile."
        error={errors.githubUsername}
      />
      <TextField
        label="LinkedIn username or profile URL"
        name="linkedinUrl"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="linkedin.com/in/your-name"
        defaultValue={defaults.linkedinUrl}
        required
        hint="Shown to your teammates."
        error={errors.linkedinUrl}
      />
      <Button type="submit" loading={pending}>
        {mode === "complete" ? "Save and continue" : "Save changes"}
      </Button>
    </form>
  );
}
