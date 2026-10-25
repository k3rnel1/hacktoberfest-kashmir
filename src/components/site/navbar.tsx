import Link from "next/link";
import { Menu } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { getPendingCount } from "@/lib/matching";
import { getSettings } from "@/lib/settings";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { Logo } from "./logo";

export async function Navbar() {
  const user = await getSessionUser();
  const admin = user ? await isAdmin(user.id) : false;

  const participant = Boolean(user) && !admin;
  const settings = await getSettings();
  const lockdown = settings.lockdown;
  const [pending, unread] = participant && !lockdown
    ? await Promise.all([getPendingCount(), getUnreadNotificationCount()])
    : [0, 0];

  const links: { href: string; label: string; badge?: number; badgeLabel?: string }[] = [
    ...(user
      ? [
          { href: admin ? "/admin" : "/dashboard", label: admin ? "Admin" : "Dashboard" },
          ...(participant && !lockdown
            ? [
                {
                  href: "/teams",
                  label: "Teams",
                  badge: pending,
                  badgeLabel: `${pending} waiting for your answer`,
                },
                {
                  href: "/teams/notifications",
                  label: "Notifications",
                  badge: unread,
                  badgeLabel: `${unread} unread`,
                },
                settings.profile_editing_open
                  ? { href: "/settings/profile", label: "Profile" }
                  : { href: "/settings/password", label: "Password" },
              ]
            : []),
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
          {links.map((link) => (
            <Button key={link.href} asChild variant="ghost" size="sm">
              <Link href={link.href}>
                {link.label}
                {link.badge ? (
                  <span
                    className="ml-1.5 grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
                    aria-label={link.badgeLabel}
                  >
                    {link.badge}
                  </span>
                ) : null}
              </Link>
            </Button>
          ))}
          {user ? (
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                Log out
              </Button>
            </form>
          ) : (
            <>
              {settings.participant_login_open && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Log in</Link>
                </Button>
              )}
              {settings.registrations_open && (
                <Button asChild size="sm">
                  <Link href="/register">Register</Link>
                </Button>
              )}
            </>
          )}
        </nav>

        <details className="group relative sm:hidden">
          <summary
            className="flex size-9 cursor-pointer list-none items-center justify-center rounded-md border border-border hover:bg-surface-2 [&::-webkit-details-marker]:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </summary>
          <div className="absolute right-0 mt-2 grid w-48 gap-1 rounded-lg border border-border bg-surface p-2 shadow-xl">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-surface-2"
              >
                {link.label}
                {link.badge ? (
                  <span
                    className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
                    aria-label={link.badgeLabel}
                  >
                    {link.badge}
                  </span>
                ) : null}
              </Link>
            ))}
            {user ? (
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2"
                >
                  Log out
                </button>
              </form>
            ) : (
              <>
                {settings.participant_login_open && (
                <Link href="/login" className="rounded-md px-3 py-2 text-sm hover:bg-surface-2">
                  Log in
                </Link>
                )}
                {settings.registrations_open && (
<Link
                  href="/register"
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  Register
                </Link>
                )}
              </>
            )}
          </div>
        </details>
      </div>
    </header>
  );
}
