import { eventConfig } from "@/config/event";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {eventConfig.name}. Open source, together.
        </p>
        <p className="font-mono text-xs">
          {eventConfig.contactEmail ? (
            <a href={`mailto:${eventConfig.contactEmail}`} className="hover:text-foreground">
              {eventConfig.contactEmail}
            </a>
          ) : (
            "Contact details to be announced"
          )}
        </p>
      </div>
    </footer>
  );
}
