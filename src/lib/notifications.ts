import "server-only";
import { createClient } from "@/lib/supabase/server";

// Notifications are created inside the database functions that perform each action
// (see the notifications migration). Reads run as the signed-in user through
// SECURITY DEFINER functions scoped by auth.uid(), so nobody can read another
// person's notifications.

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export type NotificationsResult = {
  unread: number;
  total: number;
  items: NotificationItem[];
};

export const NOTIFICATIONS_PAGE_SIZE = 100;

export async function getNotifications(): Promise<NotificationsResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_notifications", {
    p_limit: NOTIFICATIONS_PAGE_SIZE,
    p_offset: 0,
  });
  if (error || !data) throw new Error("Failed to load notifications");
  const result = data as Partial<NotificationsResult>;
  return {
    unread: Number(result.unread ?? 0),
    total: Number(result.total ?? 0),
    items: result.items ?? [],
  };
}

// Used for the badge in the navigation; a failure must never break a page.
export async function getUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_unread_notification_count");
  return error ? 0 : Number(data ?? 0);
}
