"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/admin/controls", label: "Admin controls", exact: true },
  { href: "/admin/controls/website", label: "Website settings" },
] as const;

export function ControlsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Controls sections" className="flex gap-1 border-b border-border">
      {tabs.map((tab) => {
        const active = "exact" in tab ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
