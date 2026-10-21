import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/forms/auth-card";
import { Button } from "@/components/ui/button";
import { eventConfig } from "@/config/event";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Forgot your password?"
      description="Accounts use a username, not an email address, so there is no automatic reset email."
    >
      <div className="grid gap-4 text-sm text-muted">
        <p>
          Contact the organizers
          {eventConfig.contactEmail ? (
            <>
              {" "}
              at{" "}
              <a className="text-primary hover:underline" href={`mailto:${eventConfig.contactEmail}`}>
                {eventConfig.contactEmail}
              </a>
            </>
          ) : null}{" "}
          with your username. They can issue a temporary password, and you will be asked to choose a
          new one the first time you log in.
        </p>
        <Button asChild variant="outline">
          <Link href="/login">Back to log in</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
