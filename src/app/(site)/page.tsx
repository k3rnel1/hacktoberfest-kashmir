import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  GitPullRequest,
  MapPin,
  Timer,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { eventConfig, TBA } from "@/config/event";
import { getSessionUser } from "@/lib/auth";

const steps = [
  {
    icon: UserPlus,
    title: "Create your account",
    body: "Pick a username and password. No email needed to get started.",
  },
  {
    icon: GitPullRequest,
    title: "Complete your profile",
    body: "Add your name, mobile number, Gmail, GitHub and LinkedIn so organizers can reach you.",
  },
  {
    icon: Users,
    title: "Create or join a team",
    body: "Start a team and become its leader, or join a friend's team with their invitation link.",
  },
  {
    icon: UsersRound,
    title: "Await Selection Updates",
    body: `Monitor your registered email for updates from the organizers regarding your selection status. ${eventConfig.team.maxMembers} `,
  },
];

export default async function HomePage() {
  const user = await getSessionUser();

  const details = [
    { icon: CalendarDays, label: "Date", value: eventConfig.date },
    { icon: MapPin, label: "Venue", value: eventConfig.venue },
    { icon: Timer, label: "Registration deadline", value: eventConfig.registrationDeadline },
    { icon: Users, label: "Team size", value: `Up to ${eventConfig.team.maxMembers} members` },
  ];

  return (
    <div className="grid gap-16">
      <section className="relative isolate overflow-hidden rounded-2xl border border-border px-6 py-16 sm:px-12 sm:py-24">
        <div className="grid-bg absolute inset-0 -z-10" aria-hidden />
        <Badge variant="primary" className="mb-6 font-mono">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden /> In Collaboration with BUILDFEST KASHMIR
        </Badge>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          {eventConfig.name}
          <span className="text-primary">.</span>
        </h1>
        <p className="mt-3 text-xl text-muted sm:text-2xl">{eventConfig.tagline}</p>
        <p className="mt-6 max-w-2xl text-muted">{eventConfig.description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {user ? (
            <Button asChild size="lg">
              <Link href="/dashboard">
                Go to dashboard <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg">
                <Link href="/register">
                  Register now <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">Log in</Link>
              </Button>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="details-heading" className="grid gap-4">
        <h2 id="details-heading" className="font-mono text-sm text-muted">
          # event details
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {details.map(({ icon: Icon, label, value }) => (
            <Card key={label} className="p-4">
              <Icon className="mb-3 size-4 text-primary" aria-hidden />
              <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
              <p className="mt-1 font-medium">{value ?? TBA}</p>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="how-heading" className="grid gap-4">
        <h2 id="how-heading" className="font-mono text-sm text-muted">
          # how registration works
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, body }, index) => (
            <li key={title}>
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Icon className="size-5 text-primary" aria-hidden />
                    <span className="font-mono text-xs text-muted">0{index + 1}</span>
                  </div>
                  <CardTitle className="mt-2 text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted">{body}</CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
