"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { getMissingBusinessSettingsFields, type BusinessSettingsRow } from "@/lib/business-settings-completeness";
import { isStaffOrAdmin, type Profile } from "@/lib/roles";

const DISMISS_KEY = "business-settings-completion-banner-dismissed";

// Same soft-nudge pattern as ProfileCompletionBanner, but org-level: the
// fields checked here (address/GSTIN/PAN/state/a payment method) are
// enforced as a hard block server-side on every staff/admin-initiated
// invoice-creating action (see getMissingBusinessSettingsFields's other
// callers — buy-for-customer, leads/[id]/convert, and /api/invoices
// POST) — this banner exists so staff/admin see the problem before they
// hit that block mid-task, not instead of it. Customer-facing pages
// never show this — customers aren't the ones who can fix it, and
// self-serve customer invoicing isn't gated on it in the first place.
export function BusinessSettingsCompletionBanner({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true);
  const [settings, setSettings] = useState<BusinessSettingsRow | null | "loading">("loading");

  useEffect(() => {
    if (!isStaffOrAdmin(profile)) return;
    const kickoff = setTimeout(async () => {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
      const res = await fetch("/api/business-settings");
      const data = res.ok ? await res.json() : null;
      setSettings(data?.settings ?? null);
    }, 0);
    return () => clearTimeout(kickoff);
  }, [profile]);

  if (!isStaffOrAdmin(profile) || settings === "loading" || dismissed || pathname === "/dashboard/admin/business-settings") return null;

  const missing = getMissingBusinessSettingsFields(settings);
  if (missing.length === 0) return null;

  const isAdmin = profile.account_type === "admin";

  return (
    <div
      className="mx-auto mb-6 flex max-w-[1800px] flex-wrap items-center gap-3 rounded-xl border px-4 py-3 sm:px-6 lg:px-10"
      style={{ backgroundColor: "#fde2e2", borderColor: "#f3a9a9" }}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "#b42318" }} />
      <p className="min-w-0 flex-1 text-sm" style={{ color: "#8a1a13" }}>
        <span className="font-semibold">Business Settings is incomplete</span> — {missing.join(", ")}. Invoices can&apos;t be generated until this is done.
        {!isAdmin && " Ask your org admin to complete it."}
      </p>
      {isAdmin && (
        <Link
          href="/dashboard/admin/business-settings"
          className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: "#b42318" }}
        >
          Complete Now
        </Link>
      )}
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        aria-label="Dismiss for this session"
        className="shrink-0 rounded-full p-1 transition-colors hover:bg-black/5"
        style={{ color: "#8a1a13" }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
