import { ExternalLink } from "lucide-react";
import { linkedinHref } from "@/lib/links";
import { cn } from "@/lib/utils";

// A "LinkedIn" link that opens in a new tab. Renders nothing when there is no valid
// LinkedIn profile URL, so callers can drop it in without checking first.
export function LinkedInLink({
  url,
  label = "LinkedIn",
  srLabel,
  className,
}: {
  url: string | null | undefined;
  label?: string;
  srLabel?: string;
  className?: string;
}) {
  const href = linkedinHref(url);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-1 text-primary hover:underline", className)}
    >
      {label}
      <ExternalLink className="size-3" aria-hidden />
      <span className="sr-only">{srLabel ?? "LinkedIn profile"} (opens in a new tab)</span>
    </a>
  );
}
