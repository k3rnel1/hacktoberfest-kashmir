"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import type { z } from "zod";
import { formToObject, GENERIC_ERROR, type ActionResult } from "@/lib/action";
import { fieldErrors } from "@/lib/validation";

// Validates with the same zod schema the server uses (instant feedback), then calls
// the server action, which validates again and is the real security boundary.
export function useActionForm(
  schema: z.ZodType,
  action: (formData: FormData) => Promise<ActionResult | void>,
) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFormError(null);

    const parsed = schema.safeParse(formToObject(formData));
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});

    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result && !result.ok) {
          setFormError(result.error);
          setErrors(result.fieldErrors ?? {});
        } else if (result?.ok && result.message) {
          toast.success(result.message);
        }
      } catch {
        setFormError(GENERIC_ERROR);
      }
    });
  }

  return { onSubmit, errors, formError, pending };
}
