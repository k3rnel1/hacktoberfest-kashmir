import Link from "next/link";
import { eventConfig } from "@/config/event";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-mono text-sm font-semibold">
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary"
      >
        {">_"}
      </span>
      <span>
        {eventConfig.name.split(" ")[0].toLowerCase()}
        <span className="text-primary">/</span>
        {eventConfig.name.split(" ")[1]?.toLowerCase()}
      </span>
    </Link>
  );
}
