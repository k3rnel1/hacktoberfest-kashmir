import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/forms/auth-card";
import { ProfileForm } from "@/components/forms/profile-form";
import { requireCompleteProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit profile" };

export default async function ProfileSettingsPage() {
  const { profile } = await requireCompleteProfile("/settings/profile");

  return (
    <AuthCard
      title="Your profile"
      description={`Signed in as @${profile.username}. Your username cannot be changed.`}
      footer={
        <>
          <Link href="/settings/password" className="text-primary hover:underline">
            Change password
          </Link>
          {" · "}
          <Link href="/dashboard" className="text-primary hover:underline">
            Back to dashboard
          </Link>
        </>
      }
    >
      <ProfileForm
        mode="edit"
        defaults={{
          fullName: profile.full_name ?? "",
          mobileNumber: profile.mobile_number ?? "",
          gmail: profile.gmail ?? "",
          githubUsername: profile.github_username ?? "",
          linkedinUrl: profile.linkedin_url ?? "",
        }}
      />
    </AuthCard>
  );
}
