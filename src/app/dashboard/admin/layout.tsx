"use client";

import { CommandPalette } from "@/components/crm/CommandPalette";
import { ToastProvider } from "@/components/crm/Toaster";

// The full set of admin pages already lives in the left sidebar
// (DashboardShell's ADMIN_ONLY_ITEMS + TEAM_MANAGEMENT_ITEMS +
// ANALYTICS_ITEM) — this used to repeat every one of those links again as
// a row of pill tabs up top, which was pure duplication once the sidebar
// had all of them. Just the quick-jump search stays here.
export default function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div>
        <div className="flex justify-end">
          <CommandPalette />
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </ToastProvider>
  );
}
