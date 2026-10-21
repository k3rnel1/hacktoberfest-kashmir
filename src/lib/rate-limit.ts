import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Durable, cross-instance rate limiting backed by Postgres (see rate_limit_hit),
// which works on serverless platforms where in-memory counters are not shared.

export async function clientFingerprint() {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("rate_limit_hit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  // Fail closed: if the limiter is unavailable, do not allow unbounded attempts.
  return !error && data === true;
}
