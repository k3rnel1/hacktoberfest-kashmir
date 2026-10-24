"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/teams", label: "Browse Teams", exact: true },
  { href: "/teams/looking", label: "Looking for a Team" },
  { href: "/teams/requests", label: "Requests & Invitations", badge: "pending" },
  { href: "/teams/notifications", label: "Notifications", badge: "unread" },
  { href: "/teams/finalists", label: "Finalists" },
] as const;

export function TeamsTabs({
  pendingCount,
  unreadCount,
}: {
  pendingCount: number;
  unreadCount: number;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Teams sections"
      className="flex gap-1 overflow-x-auto border-b border-border pb-px"
    >
      {tabs.map((tab) => {
        const active = "exact" in tab && tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        const badge =
          "badge" in tab ? (tab.badge === "pending" ? pendingCount : unreadCount) : 0;
        const badgeLabel =
          "badge" in tab && tab.badge === "pending"
            ? `${badge} waiting for your answer`
            : `${badge} unread`;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {tab.label}
            {badge > 0 && (
              <span
                className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
                aria-label={badgeLabel}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
