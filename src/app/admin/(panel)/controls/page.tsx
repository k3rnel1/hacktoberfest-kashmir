import type { Metadata } from "next";
import { SettingsControls } from "@/components/admin/settings-controls";
import { getStoredSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Controls · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminControlsPage() {
  // The admin layout has already verified the caller is an administrator.
  const settings = await getStoredSettings();

  return (
    <div className="grid max-w-3xl gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Controls</h1>
        <p className="mt-1 text-sm text-muted">
          Switch features on or off for participants. A feature that is off disappears from the
          site completely: its buttons, links and pages. Changes apply immediately and are
          recorded in the audit log. Administrators are never affected by these switches.
        </p>
      </div>
      <SettingsControls settings={settings} />
    </div>
  );
}
