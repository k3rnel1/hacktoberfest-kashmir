"use client";

import { useMemo, useRef, useState } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { adminLogBulkContactAction } from "@/actions/admin";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { gmailBatches, personalize, whatsappUrl } from "@/lib/contact";

export type Recipient = { id: string; name: string; mobile: string | null; email: string | null };

export function BulkContact({
  audience,
  audienceLabel,
  recipients,
}: {
  audience: string;
  audienceLabel: string;
  recipients: Recipient[];
}) {
  const [subject, setSubject] = useState("Hacktoberfest Kashmir");
  const [message, setMessage] = useState("Hi {name},\n\n");
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const logged = useRef<{ email: boolean; whatsapp: boolean }>({ email: false, whatsapp: false });

  const withEmail = useMemo(() => recipients.filter((r) => r.email), [recipients]);
  const withMobile = useMemo(() => recipients.filter((r) => r.mobile), [recipients]);

  // Email goes to everyone in BCC, so "{name}" cannot be personalised there.
  const emailBody = message.replaceAll("{name}", "everyone");
  const batches = useMemo(
    () => gmailBatches(withEmail.map((r) => r.email as string), { subject, body: emailBody }),
    [withEmail, subject, emailBody],
  );

  function log(channel: "email" | "whatsapp", count: number) {
    if (logged.current[channel]) return;
    logged.current[channel] = true;
    void adminLogBulkContactAction(channel, audience, count).catch(() => {});
  }

  function chatUrl(r: Recipient) {
    return whatsappUrl(r.mobile, personalize(message, r.name));
  }

  function openChat(r: Recipient) {
    const url = chatUrl(r);
    if (!url) return;
    log("whatsapp", withMobile.length);
    window.open(url, "_blank", "noopener,noreferrer");
    setOpened((prev) => new Set(prev).add(r.id));
  }

  const next = withMobile.find((r) => !opened.has(r.id));

  return (
    <div className="grid gap-6">
      <Card className="grid gap-4 p-4">
        <h2 className="text-lg font-semibold">Message</h2>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Email subject</span>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">
            Message. In WhatsApp, <code className="font-mono">{"{name}"}</code> becomes each
            person&apos;s first name.
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            maxLength={1500}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
          />
        </label>
        <p className="text-xs text-muted">
          Sending to <strong>{audienceLabel}</strong>: {recipients.length} participants,{" "}
          {withEmail.length} with a valid Gmail, {withMobile.length} with a valid mobile number.
        </p>
      </Card>

      <section className="grid gap-3" aria-labelledby="email-heading">
        <h2 id="email-heading" className="flex items-center gap-2 text-lg font-semibold">
          <Mail className="size-5" aria-hidden /> Send Mail (Gmail)
        </h2>
        {batches.length === 0 ? (
          <p className="text-sm text-muted">No participants with a Gmail address in this group.</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              Recipients are added in BCC so nobody sees anyone else&apos;s address. Large groups
              are split into several drafts to fit Gmail&apos;s link size. Gmail also limits how
              many emails one account can send per day.
            </p>
            <div className="flex flex-wrap gap-2">
              {batches.map((b, i) => (
                <Button key={i} asChild variant="outline">
                  <a
                    href={b.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => log("email", withEmail.length)}
                  >
                    <Mail /> Open draft {i + 1} of {batches.length} ({b.emails.length})
                  </a>
                </Button>
              ))}
              <CopyButton
                value={withEmail.map((r) => r.email).join(", ")}
                label="Copy all addresses"
              />
            </div>
          </>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="wa-heading">
        <h2 id="wa-heading" className="flex items-center gap-2 text-lg font-semibold">
          <MessageCircle className="size-5" aria-hidden /> WhatsApp
        </h2>
        {withMobile.length === 0 ? (
          <p className="text-sm text-muted">No participants with a mobile number in this group.</p>
        ) : (
          <>
            <p className="text-sm text-muted">
              WhatsApp does not allow sending one message to many people from a link, so this opens
              one chat at a time with your message already filled in. Press send in WhatsApp, then
              come back for the next. Opened chats are ticked off on this page only.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => next && openChat(next)} disabled={!next}>
                <MessageCircle />
                {next ? `Open next chat (${next.name})` : "All chats opened"}
              </Button>
              <span className="text-sm text-muted">
                {opened.size} of {withMobile.length} opened
              </span>
              {opened.size > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setOpened(new Set())}>
                  Reset
                </Button>
              )}
            </div>
            <ul className="grid max-h-96 gap-1 overflow-y-auto rounded-lg border border-border p-2 text-sm">
              {withMobile.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-2 py-1">
                  <span className={opened.has(r.id) ? "text-muted line-through" : ""}>
                    {r.name} <span className="font-mono text-xs text-muted">{r.mobile}</span>
                  </span>
                  <Button size="sm" variant="outline" onClick={() => openChat(r)}>
                    {opened.has(r.id) ? "Open again" : "Open chat"}
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
