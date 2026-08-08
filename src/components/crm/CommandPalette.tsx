"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, Users, UserPlus, Clock, Calendar, DollarSign, FileText, BarChart3, Settings, Building2, KanbanSquare,
} from "lucide-react";

type Destination = { label: string; href: string; icon: typeof Users; keywords?: string };

const DESTINATIONS: Destination[] = [
  { label: "Leads / Pipeline", href: "/dashboard/admin/leads", icon: KanbanSquare, keywords: "crm deals kanban" },
  { label: "Employees", href: "/dashboard/admin/employees", icon: Users, keywords: "staff team" },
  { label: "Create User", href: "/dashboard/admin/users", icon: UserPlus },
  { label: "Attendance", href: "/dashboard/admin/attendance", icon: Clock, keywords: "check in out" },
  { label: "Leave Requests", href: "/dashboard/admin/leave-requests", icon: Calendar, keywords: "holiday off" },
  { label: "Payroll", href: "/dashboard/admin/payroll", icon: DollarSign, keywords: "salary payslip" },
  { label: "HR Letters", href: "/dashboard/admin/hr-letters", icon: FileText, keywords: "offer appointment" },
  { label: "Reports", href: "/dashboard/admin/reports", icon: BarChart3, keywords: "export csv" },
  { label: "Analytics", href: "/dashboard/admin/analytics", icon: BarChart3 },
  { label: "Account Requests", href: "/dashboard/admin/account-requests", icon: UserPlus },
  { label: "Reviewed Account Requests", href: "/dashboard/admin/reviewed-account-requests", icon: UserPlus, keywords: "approved rejected account history" },
  { label: "Business Settings", href: "/dashboard/admin/business-settings", icon: Settings, keywords: "logo signature company settings" },
  { label: "Buy Plan for Customer", href: "/dashboard/admin/buy-for-customer", icon: Building2 },
];

// Cmd/Ctrl+K quick-nav across the admin area — a fuzzy-ish substring match
// over a static destination list (no server round-trip needed for this;
// there are only a dozen admin pages).
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DESTINATIONS;
    return DESTINATIONS.filter((d) => `${d.label} ${d.keywords ?? ""}`.toLowerCase().includes(q));
  }, [query]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        className="hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--color-accent-tint)] sm:flex"
        style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
      >
        <Search className="h-3.5 w-3.5" />
        Quick jump
        <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-semibold" style={{ borderColor: "var(--color-line)" }}>
          ⌘K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-start justify-center px-4 pt-24"
            style={{ backgroundColor: "rgba(15,23,42,0.35)" }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl"
              style={{ backgroundColor: "rgba(255,255,255,0.95)", borderColor: "var(--color-line)" }}
            >
              <div className="flex items-center gap-2.5 border-b px-4 py-3" style={{ borderColor: "var(--color-line)" }}>
                <Search className="h-4 w-4 shrink-0" style={{ color: "var(--color-ink-soft)" }} />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Jump to a page…"
                  className="w-full bg-transparent text-sm outline-none"
                  style={{ color: "var(--color-ink)" }}
                />
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {results.map((d) => (
                  <button
                    key={d.href}
                    type="button"
                    onClick={() => go(d.href)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-accent-tint)]"
                    style={{ color: "var(--color-ink)" }}
                  >
                    <d.icon className="h-4 w-4 shrink-0" style={{ color: "var(--color-action-dark)" }} />
                    {d.label}
                  </button>
                ))}
                {results.length === 0 && (
                  <p className="px-3 py-6 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
                    No matches.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
