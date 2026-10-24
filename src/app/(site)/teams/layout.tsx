import { TeamsTabs } from "@/components/teams/teams-tabs";
import { getPendingCount } from "@/lib/matching";
import { getUnreadNotificationCount } from "@/lib/notifications";

export default async function TeamsLayout({ children }: { children: React.ReactNode }) {
  // Pages below enforce sign-in; this only decides the badge on the Requests tab.
  const [pendingCount, unreadCount] = await Promise.all([
    getPendingCount(),
    getUnreadNotificationCount(),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Teams</h1>
        <p className="mt-1 text-sm text-muted">
          Find a team, find teammates, and follow your requests and notifications.
        </p>
      </div>
      <TeamsTabs pendingCount={pendingCount} unreadCount={unreadCount} />
      {children}
    </div>
  );
}
