import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/forms/auth-card";
import { RegisterForm } from "@/components/forms/register-form";
import { safeNext } from "@/lib/validation";

export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safe = safeNext(next, "");
  const loginHref = safe ? `/login?next=${encodeURIComponent(safe)}` : "/login";

  return (
    <AuthCard
      title="Create your account"
      description="Choose a username and password. You'll add your details next."
      footer={
        <>
          Already registered?{" "}
          <Link href={loginHref} className="text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <RegisterForm next={safe || undefined} />
    </AuthCard>
  );
}
