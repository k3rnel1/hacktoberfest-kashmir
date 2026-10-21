"use client";

import { registerAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { registerSchema } from "@/lib/validation";
import { FormError, PasswordField, TextField } from "./field";
import { useActionForm } from "./use-action-form";

export function RegisterForm({ next }: { next?: string }) {
  const { onSubmit, errors, formError, pending } = useActionForm(registerSchema, registerAction);

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormError message={formError} />
      <TextField
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        hint="3–20 characters: letters, numbers, underscores. Cannot be changed later."
        error={errors.username}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        error={errors.password}
      />
      <PasswordField
        label="Confirm password"
        name="confirmPassword"
        autoComplete="new-password"
        required
        error={errors.confirmPassword}
      />
      <Button type="submit" loading={pending}>
        Create account
      </Button>
    </form>
  );
}
