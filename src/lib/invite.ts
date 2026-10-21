import "server-only";
import { createHash, createHmac } from "node:crypto";
import { headers } from "next/headers";
import { env } from "@/lib/env";

// Invitation tokens are HMAC(secret, "<teamId>:<version>"). They are unguessable
// without the server secret, can be re-derived for the leader at any time, and only
// their SHA-256 hash is stored in the database. Bumping the version invalidates the
// previous link.

export function deriveInviteToken(teamId: string, version: number) {
  return createHmac("sha256", env.inviteSecret)
    .update(`${teamId}:${version}`)
    .digest("base64url");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function inviteUrl(token: string) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return `${configured.replace(/\/$/, "")}/join/${token}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/join/${token}`;
}
