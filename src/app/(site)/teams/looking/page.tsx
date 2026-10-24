import type { Metadata } from "next";
import { Search } from "lucide-react";
import { ListingPanel } from "@/components/teams/listing-panel";
import { SeekerCard } from "@/components/teams/seeker-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireCompleteProfile } from "@/lib/auth";
import { browseSeekers, getMatchingState, MATCHING_PAGE_SIZE } from "@/lib/matching";

export const metadata: Metadata = { title: "Looking for a Team", robots: { index: false } };

type SP = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function LookingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = (first(sp.q) ?? "").trim().slice(0, 100);
  const skill = (first(sp.skill) ?? "").trim().slice(0, 40);

  const { profile } = await requireCompleteProfile("/teams/looking");
  const [state, { total, seekers }] = await Promise.all([
    getMatchingState(),
    browseSeekers(q, skill),
  ]);

  const isLeader = Boolean(state.team?.is_leader);
  const teamFull = state.team ? state.team.member_count >= state.team.max_members : false;
  const blockedReason = !state.team
    ? undefined
    : !isLeader
      ? "Only your team leader can invite participants."
      : teamFull
        ? "Your team is full."
        : undefined;

  return (
    <div className="grid gap-6">
      <ListingPanel state={state} linkedinUrl={profile.linkedin_url} />

      <section aria-labelledby="seekers-heading" className="grid gap-4">
        <div>
          <h2 id="seekers-heading" className="text-xl font-semibold">
            Participants looking for a team
          </h2>
          <p className="mt-1 text-sm text-muted">
            Only the details people chose to share are shown, with their LinkedIn so you can reach
            out. Phone numbers and email addresses are never displayed.
          </p>
        </div>

        <form action="/teams/looking" method="get" role="search" className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-60 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search name, skills, interests or role"
              aria-label="Search participants"
              maxLength={100}
              className="pl-9"
            />
          </div>
          <label className="grid gap-1 text-xs text-muted">
            Skill
            <Input
              name="skill"
              defaultValue={skill}
              placeholder="e.g. React"
              maxLength={40}
              className="w-40"
            />
          </label>
          <Button type="submit" variant="secondary">
            Apply
          </Button>
        </form>

        <p className="text-sm text-muted">
          {total} {total === 1 ? "participant" : "participants"}
          {total > MATCHING_PAGE_SIZE && ` · showing the first ${MATCHING_PAGE_SIZE}, refine your search to see others`}
        </p>

        {seekers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
            {q || skill
              ? "No participants match your search."
              : "Nobody is looking for a team right now."}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {seekers.map((seeker) => (
              <SeekerCard
                key={seeker.user_id}
                seeker={seeker}
                canInvite={isLeader && !teamFull}
                inviteBlockedReason={blockedReason}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
