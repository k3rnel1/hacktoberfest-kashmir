import { ControlsTabs } from "@/components/admin/controls-tabs";

export default function ControlsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid max-w-3xl gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Controls</h1>
        <p className="mt-1 text-sm text-muted">
          Changes apply immediately and are recorded in the audit log. Administrators are never
          affected by the switches.
        </p>
      </div>
      <ControlsTabs />
      {children}
    </div>
  );
}
