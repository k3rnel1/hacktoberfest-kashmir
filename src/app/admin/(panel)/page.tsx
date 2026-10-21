import type { Metadata } from "next";
import Link from "next/link";
import { Crown, FileText, UserCheck, UserMinus, Users, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getStats } from "@/lib/admin-data";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverviewPage() {
  const stats = await getStats();

  const cards = [
    { label: "Registered users", value: stats.total_users, icon: Users, href: "/admin/users" },
    {
      label: "Completed profiles",
      value: stats.completed_profiles,
      icon: UserCheck,
      href: "/admin/users?completed=complete",
    },
    { label: "Teams", value: stats.total_teams, icon: UsersRound, href: "/admin/teams" },
    {
      label: "Team leaders",
      value: stats.total_leaders,
      icon: Crown,
      href: "/admin/users?role=leader",
    },
    {
      label: "Not in a team",
      value: stats.users_without_team,
      icon: UserMinus,
      href: "/admin/users?membership=no_team",
    },
    {
      label: "Team members (incl. leaders)",
      value: stats.total_team_members,
      icon: FileText,
      href: "/admin/users?membership=in_team",
    },
  ];

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted">Live registration numbers. Administrator accounts are not counted.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="group">
            <Card className="p-5 transition-colors group-hover:border-primary/50">
              <Icon className="mb-4 size-4 text-primary" aria-hidden />
              <p className="font-mono text-3xl font-semibold">{value}</p>
              <p className="mt-1 text-sm text-muted">{label}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
