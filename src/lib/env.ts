import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return (
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    );
  },
  get serviceRoleKey() {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get inviteSecret() {
    const secret = required("INVITE_TOKEN_SECRET");
    if (secret.length < 32) {
      throw new Error("INVITE_TOKEN_SECRET must be at least 32 characters.");
    }
    return secret;
  },
};
