import type { Metadata } from "next";
import Link from "next/link";
import { Download, MessageSquare } from "lucide-react";
import { RemoveMemberButton, ResetPasswordButton } from "@/components/admin/admin-actions";
import { href, Pagination, SearchBar, SelectFilter, SortHeader } from "@/components/admin/list-controls";
import { GmailLink, WhatsAppLink } from "@/components/admin/contact-links";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import {
  listUsers,
  parseListParams,
  parseUserFilters,
  USER_SORTS,
} from "@/lib/admin-data";
import { githubUrl } from "@/lib/teams";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Participants · Admin" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parseListParams(sp, USER_SORTS, "created_at");
  const filters = parseUserFilters(sp);
  const { rows, total } = await listUsers(params, filters);

  const path = "/admin/users";
  const query = {
    q: params.q,
    sort: params.sort,
    dir: params.dir,
    membership: filters.membership,
    role: filters.role,
    completed: filters.completed,
  };
  const sortProps = { path, sort: params.sort, dir: params.dir, query: { ...query, page: undefined } };
  const exportHref = href("/admin/users/export", {
    q: params.q,
    sort: params.sort,
    dir: params.dir,
    membership: filters.membership,
    role: filters.role,
    completed: filters.completed,
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Participants</h1>
          <p className="mt-1 text-sm text-muted">{total} matching</p>
        </div>
        <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/admin/contact">
            <MessageSquare /> Message participants
          </Link>
        </Button>
        <Button asChild variant="outline">
          {/* A plain link: the export is a file download from a server route. */}
          <a href={exportHref} download>
            <Download /> Export CSV
          </a>
        </Button>
        </div>
      </div>

      <SearchBar
        path={path}
        q={params.q}
        placeholder="Search username, name, Gmail, GitHub or team"
        hidden={{ sort: params.sort, dir: params.dir }}
      >
        <SelectFilter
          name="membership"
          label="Team"
          value={filters.membership}
          options={[
            { value: "all", label: "All" },
            { value: "in_team", label: "In a team" },
            { value: "no_team", label: "No team" },
          ]}
        />
        <SelectFilter
          name="role"
          label="Role"
          value={filters.role}
          options={[
            { value: "all", label: "All" },
            { value: "leader", label: "Leaders" },
            { value: "member", label: "Members" },
          ]}
        />
        <SelectFilter
          name="completed"
          label="Profile"
          value={filters.completed}
          options={[
            { value: "all", label: "All" },
            { value: "complete", label: "Complete" },
            { value: "incomplete", label: "Incomplete" },
          ]}
        />
      </SearchBar>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted">
          No participants match these filters.
        </div>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>
                <SortHeader {...sortProps} label="Username" column="username" />
              </TH>
              <TH>
                <SortHeader {...sortProps} label="Name" column="full_name" />
              </TH>
              <TH>Mobile</TH>
              <TH>
                <SortHeader {...sortProps} label="Gmail" column="gmail" />
              </TH>
              <TH>GitHub</TH>
              <TH>LinkedIn</TH>
              <TH>
                <SortHeader {...sortProps} label="Team" column="team_name" />
              </TH>
              <TH>
                <SortHeader {...sortProps} label="Role" column="team_role" />
              </TH>
              <TH>
                <SortHeader {...sortProps} label="Registered" column="created_at" />
              </TH>
              <TH>
                <SortHeader {...sortProps} label="Profile" column="profile_completed" />
              </TH>
              <TH>
                <span className="sr-only">Actions</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((u) => (
              <tr key={u.id}>
                <TD className="font-mono text-xs">@{u.username}</TD>
                <TD className="font-medium">{u.full_name ?? "—"}</TD>
                <TD>
                  <WhatsAppLink mobile={u.mobile_number} />
                </TD>
                <TD>
                  <GmailLink email={u.gmail} />
                </TD>
                <TD>
                  {u.github_username ? (
                    <a
                      href={githubUrl(u.github_username)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      @{u.github_username}
                    </a>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD>
                  {u.linkedin_url ? (
                    <a
                      href={u.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Profile
                    </a>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD>
                  {u.team_id ? (
                    <Link href={`/admin/teams/${u.team_id}`} className="text-primary hover:underline">
                      {u.team_name}
                    </Link>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </TD>
                <TD>
                  {u.team_role ? (
                    <Badge variant={u.team_role === "leader" ? "primary" : "default"}>
                      {u.team_role}
                    </Badge>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </TD>
                <TD className="whitespace-nowrap text-muted">{formatDate(u.created_at)}</TD>
                <TD>
                  <Badge variant={u.profile_completed ? "success" : "default"}>
                    {u.profile_completed ? "Complete" : "Incomplete"}
                  </Badge>
                </TD>
                <TD>
                  <div className="flex gap-2">
                    {u.team_role === "member" && (
                      <RemoveMemberButton userId={u.id} name={u.full_name ?? u.username} />
                    )}
                    <ResetPasswordButton userId={u.id} username={u.username} />
                  </div>
                </TD>
              </tr>
            ))}
          </TBody>
        </Table>
      )}

      <Pagination path={path} page={params.page} total={total} query={query} />
    </div>
  );
}
