import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/forms/auth-card";
import { LoginForm } from "@/components/forms/login-form";
import { Logo } from "@/components/site/logo";
import { Alert } from "@/components/ui/alert";
import { getSessionUser, isAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin login", robots: { index: false } };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;

  const user = await getSessionUser();
  if (user && (await isAdmin(user.id))) redirect("/admin");

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-12">
      <div className="flex justify-center">
        <Logo />
      </div>
      <AuthCard title="Administrator login" description="Authorized organizers only.">
        <div className="grid gap-4">
          {expired && <Alert variant="info">Your session has expired. Please sign in again.</Alert>}
          <LoginForm admin />
        </div>
      </AuthCard>
    </div>
  );
}
