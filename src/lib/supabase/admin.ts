import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Privileged client using the service-role key. Server-only: never import this from
// a Client Component. It bypasses RLS, so every caller must authorize first.
export function createAdminClient() {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Unprivileged, cookie-less client used only to verify a password.
export function createVerifierClient() {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
