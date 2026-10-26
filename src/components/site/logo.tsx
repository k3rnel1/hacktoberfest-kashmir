import Link from "next/link";
import { branding } from "@/lib/site-settings";
import { getSettings } from "@/lib/settings";

export async function Logo({ href = "/" }: { href?: string }) {
  const { name } = branding(await getSettings());
  const words = name.split(" ");
  return (
    <Link href={href} className="flex items-center gap-2 font-mono text-sm font-semibold">
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary"
      >
        {">_"}
      </span>
      <span>
        {words[0].toLowerCase()}
        {words.length > 1 && (
          <>
            <span className="text-primary">/</span>
            {words.slice(1).join(" ").toLowerCase()}
          </>
        )}
      </span>
    </Link>
  );
}
