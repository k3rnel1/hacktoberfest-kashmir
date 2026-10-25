import type { Metadata } from "next";
import { Bell } from "lucide-react";
import {
  MarkAllReadButton,
  NotificationList,
} from "@/components/notifications/notification-list";
import { requireCompleteProfile } from "@/lib/auth";
import { getNotifications, NOTIFICATIONS_PAGE_SIZE } from "@/lib/notifications";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };

export default async function NotificationsPage() {
  await requireCompleteProfile("/teams/notifications");
  const { unread, total, items } = await getNotifications();

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="mt-0.5 text-sm text-muted">
            Join requests, invitations, team changes and your team&apos;s selection status.
            {unread > 0 && ` ${unread} unread.`}
          </p>
        </div>
        <MarkAllReadButton unread={unread} />
      </div>

      {items.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
          <Bell className="size-5" aria-hidden />
          Nothing yet. You will be notified here when someone sends you a request or invitation,
          answers yours, or your team&apos;s status changes.
        </div>
      ) : (
        <>
          <NotificationList items={items} />
          {total > NOTIFICATIONS_PAGE_SIZE && (
            <p className="text-center text-xs text-muted">
              Showing your latest {NOTIFICATIONS_PAGE_SIZE} notifications.
            </p>
          )}
        </>
      )}
    </div>
  );
}
