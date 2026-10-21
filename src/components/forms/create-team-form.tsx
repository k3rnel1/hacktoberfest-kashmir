"use client";

import { createTeamAction } from "@/actions/teams";
import { Button } from "@/components/ui/button";
import { eventConfig } from "@/config/event";
import { teamSchema } from "@/lib/validation";
import { FormError, TextAreaField, TextField } from "./field";
import { useActionForm } from "./use-action-form";

export function CreateTeamForm() {
  const { onSubmit, errors, formError, pending } = useActionForm(teamSchema, createTeamAction);
  const { team } = eventConfig;

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      <FormError message={formError} />
      <TextField
        label="Team name"
        name="name"
        maxLength={team.maxNameLength}
        required
        hint="Must be unique. Letters, numbers, spaces and . _ ' - allowed."
        error={errors.name}
      />
      <TextAreaField
        label="Team description"
        name="description"
        rows={4}
        maxLength={team.maxDescriptionLength}
        required
        hint={`${team.minDescriptionLength}–${team.maxDescriptionLength} characters. What will your team work on?`}
        error={errors.description}
      />
      <Button type="submit" loading={pending}>
        Create team
      </Button>
    </form>
  );
}
