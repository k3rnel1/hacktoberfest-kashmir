import type { Metadata } from "next";
import { AuthCard } from "@/components/forms/auth-card";
import { PasswordForm } from "@/components/forms/password-form";
import { Alert } from "@/components/ui/alert";
import { requireUserAllowingPasswordChange } from "@/lib/auth";
import { safeNext } from "@/lib/validation";

export const metadata: Metadata = { title: "Change password" };

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const { profile } = await requireUserAllowingPasswordChange("/settings/password");

  return (
    <AuthCard title="Change password" description={`Account: @${profile.username}`}>
      <div className="grid gap-4">
        {profile.must_change_password && (
          <Alert variant="info">
            You are using a temporary password. Choose a new one to continue.
          </Alert>
        )}
        <PasswordForm next={safeNext(next, "") || undefined} />
      </div>
    </AuthCard>
  );
}
