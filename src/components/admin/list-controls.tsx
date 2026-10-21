import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAGE_SIZE } from "@/lib/admin-data";

type Query = Record<string, string | number | undefined>;

export function href(path: string, query: Query) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "" && value !== "all") sp.set(key, String(value));
  }
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

export function SearchBar({
  path,
  q,
  placeholder,
  hidden,
  children,
}: {
  path: string;
  q: string;
  placeholder: string;
  hidden: Query;
  children?: React.ReactNode;
}) {
  return (
    <form action={path} method="get" className="flex flex-wrap items-end gap-2" role="search">
      {Object.entries(hidden).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null,
      )}
      <div className="relative min-w-60 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          aria-label="Search"
          maxLength={100}
          className="pl-9"
        />
      </div>
      {children}
      <Button type="submit" variant="secondary">
        Apply
      </Button>
    </form>
  );
}

export function SelectFilter({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="grid gap-1 text-xs text-muted">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="h-10 rounded-md border border-border bg-surface px-2 text-sm text-foreground"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SortHeader({
  path,
  label,
  column,
  sort,
  dir,
  query,
}: {
  path: string;
  label: string;
  column: string;
  sort: string;
  dir: "asc" | "desc";
  query: Query;
}) {
  const active = sort === column;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  return (
    <Link
      href={href(path, { ...query, sort: column, dir: nextDir, page: 1 })}
      className="inline-flex items-center gap-1 hover:text-foreground"
      aria-label={`Sort by ${label}`}
    >
      {label}
      {active && (dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
    </Link>
  );
}

export function Pagination({
  path,
  page,
  total,
  query,
}: {
  path: string;
  page: number;
  total: number;
  query: Query;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2 text-sm">
      <p className="text-muted">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm" aria-disabled={page <= 1}>
          <Link
            href={href(path, { ...query, page: page - 1 })}
            className={page <= 1 ? "pointer-events-none opacity-40" : ""}
            tabIndex={page <= 1 ? -1 : undefined}
          >
            <ChevronLeft /> Prev
          </Link>
        </Button>
        <span className="font-mono text-xs text-muted">
          {page}/{pages}
        </span>
        <Button asChild variant="outline" size="sm" aria-disabled={page >= pages}>
          <Link
            href={href(path, { ...query, page: page + 1 })}
            className={page >= pages ? "pointer-events-none opacity-40" : ""}
            tabIndex={page >= pages ? -1 : undefined}
          >
            Next <ChevronRight />
          </Link>
        </Button>
      </div>
    </nav>
  );
}
