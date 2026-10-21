"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";

type BaseProps = {
  label: string;
  name: string;
  error?: string;
  hint?: string;
};

function Wrapper({
  label,
  name,
  error,
  hint,
  children,
}: BaseProps & { children: (ids: { id: string; describedBy?: string }) => React.ReactNode }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({ id, describedBy: describedBy || undefined })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-destructive" data-field={name}>
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  name,
  ...props
}: BaseProps & Omit<React.ComponentProps<"input">, "name">) {
  return (
    <Wrapper label={label} name={name} error={error} hint={hint}>
      {({ id, describedBy }) => (
        <Input
          id={id}
          name={name}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...props}
        />
      )}
    </Wrapper>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  name,
  ...props
}: BaseProps & Omit<React.ComponentProps<"textarea">, "name">) {
  return (
    <Wrapper label={label} name={name} error={error} hint={hint}>
      {({ id, describedBy }) => (
        <Textarea
          id={id}
          name={name}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...props}
        />
      )}
    </Wrapper>
  );
}

export function PasswordField({
  label,
  hint,
  error,
  name,
  autoComplete = "current-password",
  ...props
}: BaseProps & Omit<React.ComponentProps<"input">, "name" | "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <Wrapper label={label} name={name} error={error} hint={hint}>
      {({ id, describedBy }) => (
        <div className="relative">
          <Input
            id={id}
            name={name}
            type={visible ? "text" : "password"}
            autoComplete={autoComplete}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className="pr-10"
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      )}
    </Wrapper>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <Alert variant="error">{message}</Alert>;
}
