import type { Metadata } from "next";
import { WebsiteSettings } from "@/components/admin/settings-controls";
import { getStoredSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Website settings · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminWebsiteSettingsPage() {
  const settings = await getStoredSettings();

  return (
    <>
      <p className="text-sm text-muted">
        The words and details visitors see: the event name, the home page text, the footer and
        the event details. Leave a field empty to use its default.
      </p>
      <WebsiteSettings settings={settings} />
    </>
  );
}
