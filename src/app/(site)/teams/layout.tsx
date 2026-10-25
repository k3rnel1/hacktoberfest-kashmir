import { Alert } from "@/components/ui/alert";
import { TeamsTabs } from "@/components/teams/teams-tabs";
import { getFinalistsAccess } from "@/lib/finalists";
import { getPendingCount } from "@/lib/matching";
import { getRawSettings, getSettings } from "@/lib/settings";
import { LOCKDOWN_MESSAGE } from "@/lib/site-settings";
import { getUnreadNotificationCount } from "@/lib/notifications";

export default async function TeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if ((await getRawSettings()).lockdown) {
    return (
      <div className="mx-auto grid max-w-xl gap-4 py-10 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Time is up</h1>
        <Alert variant="info" className="text-left">
          {LOCKDOWN_MESSAGE}
        </Alert>
        <p className="text-sm text-muted">
          You can still see your team and its selection status on your
          dashboard.
        </p>
      </div>
    );
  }

  const settings = await getSettings();

  // Pages below enforce sign-in; this only decides the badge on the Requests tab.
  const [pendingCount, unreadCount, finalistsAccess] = await Promise.all([
    getPendingCount(),
    getUnreadNotificationCount(),
    getFinalistsAccess(),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Teams</h1>
        <p className="mt-1 text-sm text-muted">
          Find a team, find teammates, and follow your requests and
          notifications.
        </p>
      </div>
      <TeamsTabs
        pendingCount={pendingCount}
        unreadCount={unreadCount}
        showFinalists={finalistsAccess === "ok" && settings.finalists_visible}
        showMatching={settings.team_joining_open && settings.team_matching_open}
      />
      {children}
    </div>
  );
}
