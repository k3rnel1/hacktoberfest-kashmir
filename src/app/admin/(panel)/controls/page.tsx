import type { Metadata } from "next";
import { SettingsControls } from "@/components/admin/settings-controls";
import { getStoredSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Controls · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminControlsPage() {
  // The admin layout has already verified the caller is an administrator.
  const settings = await getStoredSettings();

  return (
    <>
      <p className="text-sm text-muted">
        Switch features on or off for participants. A feature that is off disappears from the site
        completely: its buttons, links and pages.
      </p>
      <SettingsControls settings={settings} />
    </>
  );
}
