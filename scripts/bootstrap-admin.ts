/* One-time administrator setup. Run locally or in CI, never in the browser:
 *   npm run admin:bootstrap
 * Reads ADMIN_USERNAME and ADMIN_INITIAL_PASSWORD from .env.local (or the shell).
 * Creates a dedicated Supabase Auth user, grants the admin role in the protected
 * admin_users table, and forces a password change at first login. */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { usernameToEmail } from "../src/lib/validation";

config({ path: ".env.local" });

function need(name: string) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. See .env.example.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = need("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = need("SUPABASE_SERVICE_ROLE_KEY");
  const username = need("ADMIN_USERNAME").trim().toLowerCase();
  const password = need("ADMIN_INITIAL_PASSWORD");

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    console.error("ADMIN_USERNAME must be 3–20 characters: letters, numbers, underscores.");
    process.exit(1);
  }
  if (password.length < 6 || password.length > 72) {
    console.error("ADMIN_INITIAL_PASSWORD must be 6–72 characters.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (lookupError) {
    console.error("Could not read profiles. Have the migrations been applied?", lookupError.message);
    process.exit(1);
  }

  if (existing) {
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", existing.id)
      .maybeSingle();
    if (adminRow) {
      console.log(`Administrator "${username}" already exists. Nothing changed.`);
      return;
    }
    console.error(
      `"${username}" is already registered as a participant. Choose a different ADMIN_USERNAME; participant accounts are never promoted automatically.`,
    );
    process.exit(1);
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: usernameToEmail(username),
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (createError || !created.user) {
    console.error("Failed to create the administrator account:", createError?.message);
    process.exit(1);
  }

  const { error: roleError } = await supabase.from("admin_users").insert({ user_id: created.user.id });
  if (roleError) {
    await supabase.auth.admin.deleteUser(created.user.id);
    console.error("Failed to grant the admin role:", roleError.message);
    process.exit(1);
  }

  await supabase.from("profiles").update({ must_change_password: true }).eq("id", created.user.id);

  console.log(`Administrator "${username}" created.`);
  console.log("Sign in at /admin/login. You must choose a new password on first login.");
  console.log("Log in immediately, then remove ADMIN_INITIAL_PASSWORD from your environment.");
  if (password.length < 12) {
    console.warn("Warning: the initial password is short. It is valid only until the first login.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
