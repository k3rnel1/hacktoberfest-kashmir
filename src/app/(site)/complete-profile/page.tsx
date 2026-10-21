import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/forms/auth-card";
import { ProfileForm } from "@/components/forms/profile-form";
import { isAdmin, requireUser } from "@/lib/auth";
import { safeNext } from "@/lib/validation";

export const metadata: Metadata = { title: "Complete your profile" };

export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const safe = safeNext(next, "/dashboard");
  const { user, profile } = await requireUser("/complete-profile");
  if (await isAdmin(user.id)) redirect("/admin");
  if (profile.profile_completed) redirect(safe);

  return (
    <AuthCard
      title="Complete your profile"
      description="All fields are required. You need a complete profile to create or join a team."
    >
      <ProfileForm
        mode="complete"
        next={safe}
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
