"use client";

import { submitProjectRepoAction } from "@/actions/teams";
import { FormError, TextField } from "@/components/forms/field";
import { useActionForm } from "@/components/forms/use-action-form";
import { Button } from "@/components/ui/button";
import { projectRepoSchema } from "@/lib/project-schema";

export function ProjectRepoForm({ teamId, current }: { teamId: string; current: string | null }) {
  const { onSubmit, errors, formError, pending } = useActionForm(projectRepoSchema, (formData) =>
    submitProjectRepoAction(teamId, formData),
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <FormError message={formError} />
      <TextField
        label="GitHub repository link"
        name="repoUrl"
        type="url"
        defaultValue={current ?? ""}
        placeholder="https://github.com/your-name/your-project"
        maxLength={200}
        hint="Leave it empty and save to remove the link."
        error={errors.repoUrl}
      />
      <Button type="submit" loading={pending} className="w-fit">
        Save link
      </Button>
    </form>
  );
}
