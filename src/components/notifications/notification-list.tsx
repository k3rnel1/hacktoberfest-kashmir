"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Crown,
  Send,
  Trash2,
  Trophy,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/actions/notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GENERIC_ERROR } from "@/lib/action";
import { internalHref } from "@/lib/links";
import type { NotificationItem } from "@/lib/notifications";
import { cn, formatDate } from "@/lib/utils";

type Tone = "info" | "success" | "danger" | "primary";

const KINDS: Record<string, { icon: LucideIcon; tone: Tone }> = {
  join_request_received: { icon: UserPlus, tone: "info" },
  join_request_accepted: { icon: UserCheck, tone: "success" },
  join_request_rejected: { icon: UserX, tone: "danger" },
  join_request_cancelled: { icon: UserMinus, tone: "info" },
  invitation_received: { icon: Send, tone: "info" },
  invitation_accepted: { icon: UserCheck, tone: "success" },
  invitation_rejected: { icon: UserX, tone: "danger" },
  invitation_cancelled: { icon: UserMinus, tone: "info" },
  member_joined: { icon: UserPlus, tone: "success" },
  member_left: { icon: UserMinus, tone: "info" },
  removed_from_team: { icon: UserMinus, tone: "danger" },
  leadership_transferred: { icon: Crown, tone: "primary" },
  team_dissolved: { icon: Trash2, tone: "danger" },
  selection_status: { icon: Trophy, tone: "primary" },
};

const TONE_CLASSES: Record<Tone, string> = {
  info: "border-border bg-surface-2 text-muted",
  success: "border-success/30 bg-success/10 text-success",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  primary: "border-primary/30 bg-primary/10 text-primary",
};

function useMarkRead() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) {
          toast.error(result.error ?? GENERIC_ERROR);
          return;
        }
        if (result.message) toast.success(result.message);
        router.refresh();
      } catch {
        toast.error(GENERIC_ERROR);
      }
    });
  }
  return { pending, run };
}

export function MarkAllReadButton({ unread }: { unread: number }) {
  const { pending, run } = useMarkRead();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={unread === 0}
      loading={pending}
      onClick={() => run(() => markAllNotificationsReadAction())}
    >
      <CheckCheck /> Mark all as read
    </Button>
  );
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const { pending, run } = useMarkRead();
  const kind = KINDS[item.type] ?? { icon: Bell, tone: "info" as const };
  const Icon = kind.icon;
  const href = internalHref(item.link);

  return (
    <li>
      <Card className={cn("flex items-start gap-3 p-4", !item.is_read && "border-primary/40")}>
        <span
          aria-hidden
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full border",
            TONE_CLASSES[kind.tone],
          )}
        >
          <Icon className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="break-words">{item.title}</span>
            {!item.is_read && <Badge variant="primary">New</Badge>}
          </p>
          {item.body && <p className="mt-0.5 break-words text-sm text-muted">{item.body}</p>}
          <p className="mt-1 text-xs text-muted">{formatDate(item.created_at)}</p>

          {(href || !item.is_read) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {href && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={href}>View</Link>
                </Button>
              )}
              {!item.is_read && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={pending}
                  onClick={() => run(() => markNotificationReadAction(item.id))}
                >
                  Mark as read
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    </li>
  );
}

export function NotificationList({ items }: { items: NotificationItem[] }) {
  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <NotificationRow key={item.id} item={item} />
      ))}
    </ul>
  );
}
