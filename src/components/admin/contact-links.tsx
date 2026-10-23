import { gmailComposeUrl, isEmail, whatsappUrl } from "@/lib/contact";

// Clickable contact details for the admin panel. External links open in a new tab.

export function WhatsAppLink({ mobile }: { mobile: string | null }) {
  const url = whatsappUrl(mobile);
  if (!mobile) return <>—</>;
  if (!url) return <>{mobile}</>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Open WhatsApp chat"
      className="font-mono text-xs text-primary hover:underline"
    >
      {mobile}
    </a>
  );
}

export function GmailLink({ email }: { email: string | null }) {
  if (!email) return <>—</>;
  if (!isEmail(email)) return <>{email}</>;
  return (
    <a
      href={gmailComposeUrl({ to: [email] })}
      target="_blank"
      rel="noopener noreferrer"
      title="Write an email in Gmail"
      className="text-xs text-primary hover:underline"
    >
      {email}
    </a>
  );
}
