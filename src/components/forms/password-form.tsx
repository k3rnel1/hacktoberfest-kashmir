"use client";

import { changePasswordAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { changePasswordSchema } from "@/lib/validation";
import { FormError, PasswordField } from "./field";
import { useActionForm } from "./use-action-form";

export function PasswordForm({ next }: { next?: string }) {
  const { onSubmit, errors, formError, pending } = useActionForm(
    changePasswordSchema,
    changePasswordAction,
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormError message={formError} />
      <PasswordField
        label="Current password"
        name="currentPassword"
        autoComplete="current-password"
        required
        error={errors.currentPassword}
      />
      <PasswordField
        label="New password"
        name="newPassword"
        autoComplete="new-password"
        required
        hint="At least 10 characters, with letters and numbers."
        error={errors.newPassword}
      />
      <PasswordField
        label="Confirm new password"
        name="confirmPassword"
        autoComplete="new-password"
        required
        error={errors.confirmPassword}
      />
      <Button type="submit" loading={pending}>
        Update password
      </Button>
    </form>
  );
}
