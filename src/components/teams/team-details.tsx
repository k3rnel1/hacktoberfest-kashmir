"use client";

import { Crown, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LinkedInLink } from "@/components/linkedin-link";
import type { BrowseTeam } from "@/lib/matching";

export function TeamDetailsDialog({ team }: { team: BrowseTeam }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Details
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="break-words pr-6">{team.name}</DialogTitle>
          <DialogDescription>
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <Crown className="size-3" aria-hidden /> Led by {team.leader_name}
              </span>
              <LinkedInLink
                url={team.leader_linkedin_url}
                srLabel={`${team.leader_name} (team leader) on LinkedIn`}
              />
            </span>
          </DialogDescription>
        </DialogHeader>

        <p className="whitespace-pre-line break-words text-sm">{team.description}</p>

        <div className="grid gap-2">
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Users className="size-4" aria-hidden />
            {team.member_count} of {team.max_members} members
            {team.is_open ? (
              <Badge variant="success">
                {team.open_slots} open {team.open_slots === 1 ? "position" : "positions"}
              </Badge>
            ) : (
              <Badge variant="destructive">Full</Badge>
            )}
          </p>
          <ul className="grid gap-1 text-sm">
            {team.members.map((name, i) => (
              <li key={`${name}-${i}`} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-border" aria-hidden />
                {name}
                {i === 0 && <span className="text-xs text-muted">(leader)</span>}
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
