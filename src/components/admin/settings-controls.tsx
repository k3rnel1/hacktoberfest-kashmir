"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { Lock, LockOpen } from "lucide-react";
import { toast } from "sonner";
import {
  adminBroadcastNotificationAction,
  adminUpdateSettingsAction,
} from "@/actions/admin";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { GENERIC_ERROR } from "@/lib/action";
import { eventConfig } from "@/config/event";
import {
  BROADCAST_AUDIENCES,
  SETTING_GROUPS,
  type SettingKey,
  type SiteSettings,
} from "@/lib/site-settings";
import { cn } from "@/lib/utils";

// Saves immediately and refreshes. Every change is recorded in the audit log.
function useSave() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function save(changes: Record<string, unknown>, onFail?: () => void) {
    startTransition(async () => {
      try {
        const result = await adminUpdateSettingsAction(changes);
        if (!result.ok) {
          toast.error(result.error);
          onFail?.();
          return;
        }
        if (result.message) toast.success(result.message);
        router.refresh();
      } catch (error) {
        unstable_rethrow(error);
        toast.error(GENERIC_ERROR);
        onFail?.();
      }
    });
  }
  return { save, pending };
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-border transition-colors disabled:opacity-50",
        checked ? "bg-success" : "bg-surface-2",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "inline-block size-4 rounded-full bg-white transition-transform",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}

function SettingRow({
  settingKey,
  label,
  description,
  value,
}: {
  settingKey: SettingKey;
  label: string;
  description: string;
  value: boolean;
}) {
  const [checked, setChecked] = useState(value);
  const { save, pending } = useSave();

  return (
    <li className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {label}
          <Badge variant={checked ? "success" : "destructive"}>
            {settingKey.endsWith("_visible")
              ? checked
                ? "Visible"
                : "Hidden"
              : checked
                ? "Open"
                : "Closed"}
          </Badge>
        </p>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <Switch
        label={label}
        checked={checked}
        disabled={pending}
        onChange={(next) => {
          setChecked(next);
          save({ [settingKey]: next }, () => setChecked(!next));
        }}
      />
    </li>
  );
}

function Announcement({ current }: { current: string | null }) {
  const [text, setText] = useState(current ?? "");
  const { save, pending } = useSave();

  return (
    <Card className="grid gap-3 p-5">
      <div>
        <h2 className="text-lg font-semibold">Announcement banner</h2>
        <p className="mt-1 text-sm text-muted">
          Shown at the top of every page for participants and visitors. Leave it
          empty to hide it.
        </p>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="sr-only">Announcement text</span>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder="For example: Team formation closes tonight at 11 PM."
          disabled={pending}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={pending}
          disabled={text.trim() === (current ?? "")}
          onClick={() =>
            save({ announcement: text.trim() === "" ? null : text.trim() })
          }
        >
          Save banner
        </Button>
        {current && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setText("");
              save({ announcement: null });
            }}
          >
            Remove banner
          </Button>
        )}
      </div>
    </Card>
  );
}

function LockdownCard({ active }: { active: boolean }) {
  const router = useRouter();
  return (
    <Card
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 p-5",
        active && "border-destructive/60",
      )}
    >
      <div className="min-w-0">
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
          Lockdown
          <Badge variant={active ? "destructive" : "default"}>
            {active ? "Active" : "Off"}
          </Badge>
        </h2>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Ends all participant interaction at once: no registrations, no Teams
          tab, no profile edits, and no leaving, kicking, dissolving or joining.
          Participants can still log in and see their dashboard, team page and
          selection status, and every action tells them time is up. Your
          individual switches below are kept and apply again when you lift
          lockdown.
        </p>
      </div>
      <ConfirmDialog
        destructive={!active}
        trigger={
          <Button variant={active ? "outline" : "destructive"}>
            {active ? <LockOpen /> : <Lock />}{" "}
            {active ? "Lift lockdown" : "Start lockdown"}
          </Button>
        }
        title={active ? "Lift the lockdown?" : "Start the lockdown?"}
        description={
          active
            ? "Participants will be able to interact again according to the switches below."
            : "Everything participants can change will stop immediately. You can lift it at any time."
        }
        confirmLabel={active ? "Lift lockdown" : "Start lockdown"}
        action={async () => {
          const result = await adminUpdateSettingsAction(
            active
              ? { lockdown: false, lockdown_at: null }
              : { lockdown: true },
          );
          router.refresh();
          return result;
        }}
      />
    </Card>
  );
}

const EVENT_FIELDS = [
  { key: "event_date", label: "Date", fallback: eventConfig.date },
  { key: "event_venue", label: "Venue", fallback: eventConfig.venue },
  {
    key: "event_registration_deadline",
    label: "Registration deadline",
    fallback: eventConfig.registrationDeadline,
  },
] as const;

function EventDetails({ settings }: { settings: SiteSettings }) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(EVENT_FIELDS.map((f) => [f.key, settings[f.key] ?? ""])),
  );
  const { save, pending } = useSave();
  const dirty = EVENT_FIELDS.some(
    (f) => values[f.key].trim() !== (settings[f.key] ?? ""),
  );

  return (
    <Card className="grid gap-3 p-5">
      <div>
        <h2 className="text-lg font-semibold">Event details</h2>
        <p className="mt-1 text-sm text-muted">
          The date, venue and registration deadline shown on the home page.
          Leave a field empty to show its default. Team size always follows the
          real team limit.
        </p>
      </div>
      {EVENT_FIELDS.map((f) => (
        <label key={f.key} className="grid gap-1 text-sm">
          <span className="text-muted">{f.label}</span>
          <Input
            value={values[f.key]}
            onChange={(e) =>
              setValues((v) => ({ ...v, [f.key]: e.target.value }))
            }
            maxLength={100}
            placeholder={`Default: ${f.fallback}`}
            disabled={pending}
          />
        </label>
      ))}
      <div>
        <Button
          size="sm"
          loading={pending}
          disabled={!dirty}
          onClick={() =>
            save(
              Object.fromEntries(
                EVENT_FIELDS.map((f) => [
                  f.key,
                  values[f.key].trim() === "" ? null : values[f.key].trim(),
                ]),
              ),
            )
          }
        >
          Save event details
        </Button>
      </div>
    </Card>
  );
}

function SendNotification() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<string>("all");
  const label =
    BROADCAST_AUDIENCES.find((a) => a.value === audience)?.label ?? "";

  return (
    <Card className="grid gap-3 p-5">
      <div>
        <h2 className="text-lg font-semibold">Send a notification</h2>
        <p className="mt-1 text-sm text-muted">
          Appears in the Notifications tab of the chosen participants, with an
          unread badge. It is not emailed and cannot be recalled once sent.
        </p>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Title</span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Message (optional)</span>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          rows={3}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Send to</span>
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="h-10 w-fit rounded-md border border-border bg-surface px-2 text-sm text-foreground"
        >
          {BROADCAST_AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </label>
      <div>
        <ConfirmDialog
          destructive={false}
          trigger={
            <Button disabled={title.trim() === ""}>Send notification</Button>
          }
          title="Send this notification?"
          description={`“${title.trim()}” will be sent to: ${label}. This cannot be undone.`}
          confirmLabel="Send"
          action={async () => {
            const result = await adminBroadcastNotificationAction({
              title,
              body,
              audience,
            });
            if (result.ok) {
              setTitle("");
              setBody("");
            }
            return result;
          }}
        />
      </div>
    </Card>
  );
}

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ScheduleRow({
  settingKey,
  label,
  description,
  stored,
}: {
  settingKey: "registrations_close_at" | "lockdown_at";
  label: string;
  description: string;
  stored: string | null;
}) {
  // Filled in after mount so the server and the browser agree on the first render.
  const [value, setValue] = useState("");
  const { save, pending } = useSave();
  useEffect(() => setValue(toLocalInput(stored)), [stored]);

  const passed = stored !== null && new Date(stored).getTime() <= Date.now();
  const dirty = value !== toLocalInput(stored);

  return (
    <li className="grid gap-2 py-4">
      <p className="flex flex-wrap items-center gap-2 font-medium">
        {label}
        {stored && (
          <Badge variant={passed ? "destructive" : "warning"}>
            {passed ? "Has happened" : "Scheduled"}
          </Badge>
        )}
      </p>
      <p className="text-sm text-muted">{description}</p>
      <div className="flex flex-wrap gap-2">
        <Input
          type="datetime-local"
          aria-label={label}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={pending}
          className="w-auto"
        />
        <Button
          size="sm"
          loading={pending}
          disabled={!dirty || value === ""}
          onClick={() => save({ [settingKey]: new Date(value).toISOString() })}
        >
          Save
        </Button>
        {stored && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setValue("");
              save({ [settingKey]: null });
            }}
          >
            Clear
          </Button>
        )}
      </div>
    </li>
  );
}

function Schedules({ settings }: { settings: SiteSettings }) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-semibold">Schedules</h2>
      <p className="mt-1 text-sm text-muted">
        Switch things off automatically at a set time, in your local time zone.
        Clear a time to cancel it or to reopen after it has passed.
      </p>
      <ul className="mt-2 divide-y divide-border">
        <ScheduleRow
          settingKey="registrations_close_at"
          label="Close registrations at"
          description="New accounts can no longer be created after this time."
          stored={settings.registrations_close_at}
        />
        <ScheduleRow
          settingKey="lockdown_at"
          label="Start lockdown at"
          description="Lockdown starts by itself at this time. Lifting lockdown clears it."
          stored={settings.lockdown_at}
        />
      </ul>
    </Card>
  );
}

export function SettingsControls({ settings }: { settings: SiteSettings }) {
  return (
    <div className="grid gap-6">
      <LockdownCard active={settings.lockdown} />

      {SETTING_GROUPS.map((group) => (
        <Card key={group.title} className="p-5">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          <p className="mt-1 text-sm text-muted">{group.description}</p>
          <ul className="mt-2 divide-y divide-border">
            {group.items.map((item) => (
              <SettingRow
                key={`${item.key}-${settings[item.key]}`}
                settingKey={item.key}
                label={item.label}
                description={item.description}
                value={settings[item.key]}
              />
            ))}
          </ul>
        </Card>
      ))}

      <EventDetails
        key={EVENT_FIELDS.map((f) => settings[f.key] ?? "").join("|")}
        settings={settings}
      />

      <Announcement
        key={settings.announcement ?? ""}
        current={settings.announcement}
      />

      <SendNotification />
    </div>
  );
}
