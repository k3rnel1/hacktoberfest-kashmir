// Helpers for opening WhatsApp chats and Gmail drafts. Everything here only builds
// links: nothing is sent from the server. The admin reviews and presses send.

export function whatsappDigits(mobile: string | null | undefined): string | null {
  const digits = (mobile ?? "").replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

// wa.me opens WhatsApp Desktop / WhatsApp Web on a computer and the app on a phone.
export function whatsappUrl(mobile: string | null | undefined, text?: string): string | null {
  const digits = whatsappDigits(mobile);
  if (!digits) return null;
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`;
}

const EMAIL = /^[^\s@,<>"]+@[^\s@,<>"]+\.[^\s@,<>"]+$/;

export function isEmail(value: string | null | undefined): value is string {
  return Boolean(value && EMAIL.test(value));
}

type Draft = { to?: string[]; bcc?: string[]; subject?: string; body?: string };

// Opens a Gmail compose window (browser, or the Gmail app on a phone).
export function gmailComposeUrl({ to = [], bcc = [], subject, body }: Draft): string {
  const parts = ["view=cm", "fs=1"];
  if (to.length) parts.push(`to=${encodeURIComponent(to.join(","))}`);
  if (bcc.length) parts.push(`bcc=${encodeURIComponent(bcc.join(","))}`);
  if (subject) parts.push(`su=${encodeURIComponent(subject)}`);
  if (body) parts.push(`body=${encodeURIComponent(body)}`);
  return `https://mail.google.com/mail/?${parts.join("&")}`;
}

// Gmail drafts are opened through a URL, and URLs have a length limit, so a large
// audience is split into several drafts. Recipients go in BCC so participants never
// see each other's addresses.
export function gmailBatches(
  emails: string[],
  draft: { subject?: string; body?: string },
  maxUrlLength = 6000,
): { emails: string[]; url: string }[] {
  const batches: { emails: string[]; url: string }[] = [];
  let current: string[] = [];
  for (const email of emails) {
    const next = [...current, email];
    if (current.length > 0 && gmailComposeUrl({ ...draft, bcc: next }).length > maxUrlLength) {
      batches.push({ emails: current, url: gmailComposeUrl({ ...draft, bcc: current }) });
      current = [email];
    } else {
      current = next;
    }
  }
  if (current.length) batches.push({ emails: current, url: gmailComposeUrl({ ...draft, bcc: current }) });
  return batches;
}

// "{name}" in a message template becomes the participant's first name.
export function personalize(template: string, fullName: string | null | undefined): string {
  const first = (fullName ?? "").trim().split(/\s+/)[0] || "there";
  return template.replaceAll("{name}", first);
}
