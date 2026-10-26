import "server-only";
import { cache } from "react";
import { fail, type ActionResult } from "@/lib/action";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_SETTINGS,
  EVENT_DETAIL_KEYS,
  LOCK_ALL_KEYS,
  LOCKDOWN_MESSAGE,
  closedMessage,
  SETTING_KEYS,
  type SettingKey,
  type SiteSettings,
} from "@/lib/site-settings";

// Read with the service-role client (participants and visitors have no direct access
// to the settings table). One query per request. If the table cannot be read, for
// example because the migration has not been applied yet, the site behaves as it did
// before these controls existed instead of going down.
export const getStoredSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const { data, error } = await createAdminClient()
      .from("site_settings")
      .select(
        [...SETTING_KEYS, "announcement", "lockdown", "registrations_close_at", "lockdown_at", ...EVENT_DETAIL_KEYS].join(", "),
      )
      .eq("id", true)
      .maybeSingle();
    if (error || !data) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(data as unknown as Partial<SiteSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
});

// The stored settings with the schedules applied: once a scheduled time has passed the
// matching switch reads as changed. This is what the site enforces.
export const getRawSettings = cache(async (): Promise<SiteSettings> => {
  const stored = await getStoredSettings();
  const now = Date.now();
  const passed = (iso: string | null) => iso !== null && new Date(iso).getTime() <= now;
  return {
    ...stored,
    registrations_open: stored.registrations_open && !passed(stored.registrations_close_at),
    lockdown: stored.lockdown || passed(stored.lockdown_at),
  };
});

// What participants actually experience: during lockdown every participant switch reads
// as closed, whatever the individual switches say. The admin Controls page uses
// getRawSettings so the individual switches keep their own values.
export const getSettings = cache(async (): Promise<SiteSettings> => {
  const raw = await getRawSettings();
  if (!raw.lockdown) return raw;
  const locked = { ...raw };
  for (const key of LOCK_ALL_KEYS) locked[key] = false;
  return locked;
});

// For server actions: blocks anything at all during lockdown (for actions that have no
// switch of their own, such as withdrawing a listing).
export async function lockdownResult(): Promise<ActionResult | null> {
  return (await getRawSettings()).lockdown ? fail(LOCKDOWN_MESSAGE) : null;
}

// For server actions: returns a failure result when the feature is switched off, or
// null when it is open.
export async function closedResult(key: SettingKey): Promise<ActionResult | null> {
  const settings = await getSettings();
  return settings[key] ? null : fail(closedMessage(settings, key));
}
