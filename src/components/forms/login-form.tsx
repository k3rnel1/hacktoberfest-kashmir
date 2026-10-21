"use client";

import Link from "next/link";
import { adminLoginAction, loginAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { loginSchema } from "@/lib/validation";
import { FormError, PasswordField, TextField } from "./field";
import { useActionForm } from "./use-action-form";

export function LoginForm({ next, admin = false }: { next?: string; admin?: boolean }) {
  const { onSubmit, errors, formError, pending } = useActionForm(
    loginSchema,
    admin ? adminLoginAction : loginAction,
  );

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
        error={errors.username}
      />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        required
        error={errors.password}
      />
      {!admin && (
        <Link href="/forgot-password" className="-mt-2 text-xs text-muted hover:text-primary">
          Forgot your password?
        </Link>
      )}
      <Button type="submit" loading={pending}>
        {admin ? "Sign in to admin" : "Log in"}
      </Button>
    </form>
  );
}
