"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/admin/leads", label: "Leads CRM" },
  { href: "/dashboard/admin/account-requests", label: "Account Requests" },
  { href: "/dashboard/admin/users", label: "Create User" },
  { href: "/dashboard/admin/attendance", label: "Attendance" },
  { href: "/dashboard/admin/leave-requests", label: "Leave Requests" },
  { href: "/dashboard/admin/analytics", label: "Analytics" },
];

export default function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <nav className="flex gap-2 overflow-x-auto border-b" style={{ borderColor: "var(--color-line)" }}>
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors"
              style={
                active
                  ? { borderColor: "var(--color-action)", color: "var(--color-ink)" }
                  : { borderColor: "transparent", color: "var(--color-ink-soft)" }
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
