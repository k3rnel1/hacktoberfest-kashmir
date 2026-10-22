import { eventConfig } from "@/config/event";

const SOCIAL_LABELS = {
  github: "GitHub",
  instagram: "Instagram",
  linkedin: "LinkedIn",
} as const;

export function Footer() {
  // Only socials with a URL set in event.ts are shown.
  const socials: { key: string; label: string; url: string }[] = [];
  for (const key of Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[]) {
    const url = eventConfig.socials[key];
    if (url) socials.push({ key, label: SOCIAL_LABELS[key], url });
  }

  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {eventConfig.name}.
        </p>
        {socials.length > 0 && (
          <ul className="flex items-center gap-4" aria-label="Social links">
            {socials.map((s) => (
              <li key={s.key}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="font-mono text-xs">
          {eventConfig.contactEmail ? (
            <a href={`mailto:${eventConfig.contactEmail}`} className="hover:text-foreground">
              {eventConfig.contactEmail}
            </a>
          ) : (
            "alizubairsh@gmail.com"
          )}
        </p>
      </div>
    </footer>
  );
}
