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
import { getSettings } from "@/lib/settings";
import { branding, teamSize } from "@/lib/site-settings";

const getSteps = (size: number) => [
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
    body: `Start a team and become its leader, or join someone else's as a member. Teams can have up to ${size} members.`,
  },
  {
    icon: UsersRound,
    title: "Await Selection Updates",
    body: "Monitor the team page for updates in the selection status.",
  },
];

export default async function HomePage() {
  const user = await getSessionUser();
  const settings = await getSettings();
  const brand = branding(settings);
  const steps = getSteps(teamSize(settings));

  const details: {
    icon: typeof CalendarDays;
    label: string;
    value: string | null | undefined;
    mapUrl?: string | null;
  }[] = [
    { icon: CalendarDays, label: "Date", value: settings.event_date ?? eventConfig.date },
    {
      icon: MapPin,
      label: "Venue",
      value: settings.event_venue ?? eventConfig.venue,
      mapUrl: settings.event_venue_map_url,
    },
    {
      icon: Timer,
      label: "Registration deadline",
      value: settings.event_registration_deadline ?? eventConfig.registrationDeadline,
    },
    { icon: Users, label: "Team size", value: `Up to ${teamSize(settings)} members` },
  ];

  return (
    <div className="grid gap-16">
      <section className="relative isolate overflow-hidden rounded-2xl border border-border px-6 py-16 sm:px-12 sm:py-24">
        <div className="grid-bg absolute inset-0 -z-10" aria-hidden />
        <Badge variant="primary" className="mb-6 font-mono">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden /> {brand.badge}
        </Badge>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
          {brand.name}
          <span className="text-primary">.</span>
        </h1>
        <p className="mt-3 text-xl text-muted sm:text-2xl">{brand.tagline}</p>
        <p className="mt-6 max-w-2xl text-muted">{brand.description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {user ? (
            <Button asChild size="lg">
              <Link href="/dashboard">
                Go to dashboard <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              {settings.registrations_open && (
                <Button asChild size="lg">
                  <Link href="/register">
                    Register now <ArrowRight />
                  </Link>
                </Button>
              )}
              {settings.participant_login_open && (
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">Log in</Link>
                </Button>
              )}
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="details-heading" className="grid gap-4">
        <h2 id="details-heading" className="font-mono text-sm text-muted">
          # event details
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {details.map(({ icon: Icon, label, value, mapUrl }) => (
            <Card key={label} className="p-4">
              <Icon className="mb-3 size-4 text-primary" aria-hidden />
              <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="font-medium">{value ?? TBA}</p>
                {mapUrl && (
                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-primary hover:bg-surface-2"
                  >
                    <MapPin className="size-3" aria-hidden /> View map
                  </a>
                )}
              </div>
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
