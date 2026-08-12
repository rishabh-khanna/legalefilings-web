"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Users, Network, CheckCircle2, X } from "lucide-react";

type ChecklistItem = { key: string; label: string; description: string; href: string; done: boolean; icon: typeof Building2 };

// Admin-only, shown on the main Overview page until either every item's
// done or the admin dismisses it. A brand-new org (approved via a CRM
// access request, or otherwise) used to land on the exact same generic
// dashboard as a 2-year-old org — empty Departments, zero employees, no
// Business Settings filled in — with nothing pointing them toward any of
// the setup screens that actually exist. Business Finance already has a
// real first-run wizard (FinanceSetupWizard.tsx); this is the org-level
// equivalent, just as a lightweight checklist rather than a gate, since
// unlike Business Finance nothing here needs to block the rest of the
// dashboard from being usable.
export function GettingStartedChecklist({
  organizationId,
  businessSettingsDone,
  hasTeamMembers,
  hasDepartments,
}: {
  organizationId: string;
  businessSettingsDone: boolean;
  hasTeamMembers: boolean;
  hasDepartments: boolean;
}) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const kickoff = setTimeout(() => {
      setDismissed(window.localStorage.getItem(`getting-started-dismissed:${organizationId}`) === "1");
    }, 0);
    return () => clearTimeout(kickoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items: ChecklistItem[] = [
    {
      key: "company",
      label: "Fill in Business Settings",
      description: "Address, GSTIN, PAN, state, and a payment method — required before invoices can be generated.",
      href: "/dashboard/admin/business-settings",
      done: businessSettingsDone,
      icon: Building2,
    },
    {
      key: "team",
      label: "Add your team",
      description: "Create logins for the staff who'll actually work in here.",
      href: "/dashboard/admin/users",
      done: hasTeamMembers,
      icon: Users,
    },
    {
      key: "departments",
      label: "Set up departments (optional)",
      description: "Group your team and build a role ladder — or skip this and use it later.",
      href: "/dashboard/admin/departments",
      done: hasDepartments,
      icon: Network,
    },
  ];

  const allDone = items.every((i) => i.done);
  if (dismissed || allDone) return null;

  function dismiss() {
    window.localStorage.setItem(`getting-started-dismissed:${organizationId}`, "1");
    setDismissed(true);
  }

  return (
    <div className="relative mb-6 rounded-2xl border p-5" style={{ borderColor: "var(--color-line)", background: "linear-gradient(180deg, var(--color-accent-tint) 0%, #fff 100%)" }}>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-4 top-4 rounded-full p-1 transition-colors hover:bg-white/60"
      >
        <X className="h-4 w-4" style={{ color: "var(--color-ink-soft)" }} />
      </button>
      <p className="text-base font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>Getting started</p>
      <p className="mt-0.5 text-sm" style={{ color: "var(--color-ink-soft)" }}>A few things worth setting up before your team dives in.</p>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-start gap-2.5 rounded-xl border bg-white p-3 transition-transform hover:scale-[1.02] dark:bg-[var(--color-paper-raised)]"
              style={{ borderColor: "var(--color-line)" }}
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={item.done ? { backgroundColor: "var(--color-success-tint)", color: "var(--color-success)" } : { backgroundColor: "var(--color-accent-tint)", color: "var(--color-action-dark)" }}
              >
                {item.done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span>
                <span className="block text-sm font-semibold" style={{ color: "var(--color-ink)" }}>{item.label}</span>
                <span className="mt-0.5 block text-xs" style={{ color: "var(--color-ink-soft)" }}>{item.description}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
