import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/forms/auth-card";
import { LoginForm } from "@/components/forms/login-form";
import { Alert } from "@/components/ui/alert";
import { safeNext } from "@/lib/validation";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string }>;
}) {
  const { next, expired } = await searchParams;
  const safe = safeNext(next, "");
  const registerHref = safe ? `/register?next=${encodeURIComponent(safe)}` : "/register";

  return (
    <AuthCard
      title="Welcome back"
      description="Log in with your username and password."
      footer={
        <>
          New here?{" "}
          <Link href={registerHref} className="text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <div className="grid gap-4">
        {expired && <Alert variant="info">Your session has expired. Please log in again.</Alert>}
        <LoginForm next={safe || undefined} />
      </div>
    </AuthCard>
  );
}
