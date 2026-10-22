"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GENERIC_ERROR, type ActionResult } from "@/lib/action";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  action,
  destructive = true,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  action: () => Promise<ActionResult<unknown> | void>;
  destructive?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function confirm() {
    startTransition(async () => {
      try {
        const result = await action();
        if (result && !result.ok) {
          toast.error(result.error);
          return;
        }
        if (result?.ok && result.message) toast.success(result.message);
        setOpen(false);
        router.refresh();
      } catch (error) {
        // A server action that calls redirect() rejects with a redirect signal. Let
        // Next handle the navigation instead of showing an error message.
        unstable_rethrow(error);
        toast.error(GENERIC_ERROR);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={confirm}
            loading={pending}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
