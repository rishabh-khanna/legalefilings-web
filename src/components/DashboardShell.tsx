"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isStaffOrAdmin, roleLabel, type Profile } from "@/lib/roles";
import { isGrantActive, type ToolKey } from "@/lib/tool-grants";
import { BrandSpinner } from "@/components/BrandSpinner";
import { Logo } from "@/components/Logo";
import { ProfileCompletionBanner } from "@/components/dashboard/ProfileCompletionBanner";
import { BusinessSettingsCompletionBanner } from "@/components/dashboard/BusinessSettingsCompletionBanner";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

type Session = {
  name: string;
  email: string;
  profile: Profile;
  departmentRole: { title: string; is_manager_level: boolean } | null;
  grantedTools: Set<ToolKey>;
  orgName: string | null;
};
// `section` groups the desktop nav into labeled clusters instead of one
// long undifferentiated list — undefined means "no header" (top-level
// items like Overview that should just sit on their own).
type NavItem = { href: string; label: string; exact?: boolean; section?: string; toolKey?: ToolKey };

// The icon rail's own shape, derived from navItems at render time (see
// buildNavItems below for how the flat list itself is assembled).
type RailEntry =
  | { type: "link"; key: string; href: string; label: string; icon: typeof DEFAULT_NAV_ICON; tint: { bg: string; fg: string }; active: boolean }
  | { type: "group"; key: string; section: string; items: NavItem[]; icon: typeof DEFAULT_NAV_ICON; tint: { bg: string; fg: string }; active: boolean };

const CUSTOMER_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/invoices", label: "My Invoices", section: "Billing" },
  { href: "/dashboard/orders", label: "Order History", section: "Billing" },
  // Grouped under "CRM Access", not Billing — Business Finance is
  // itself a form of CRM access already granted to a customer (their
  // own bookkeeping tool), not a billing/payments concern. Only Reports
  // joins it here, not every finance sub-page — view_reports is the one
  // permission every book role (owner/admin/accountant/employee/viewer)
  // has, so it's the only sub-page safe to put in a nav that has no
  // idea what book-level role the viewer holds. Import/Recurring/
  // Budgets/Team/Activity/Settings each require a permission at least
  // one role lacks (see EXPENSE_ROLE_PERMISSIONS) — those stay as
  // buttons ON the finance page itself, where `can(...)` can actually
  // hide them per role instead of showing a dead-end nav link.
  { href: "/dashboard/finance", label: "Business Finance", section: "CRM Access" },
  { href: "/dashboard/finance/reports", label: "Finance Reports", section: "CRM Access" },
  // No section — a standalone top-level item, same shape as Overview,
  // not nested inside the CRM Access group. Requesting access is a
  // different kind of thing from an access you already have, so it
  // shouldn't read as one more item inside that same group. Always
  // visible to every customer, not just surfaced as a card at the
  // bottom of Overview — a customer who's already been approved for
  // their own CRM (promoted to admin of a new org) never actually
  // lands on this nav shape again, so this item is really for the two
  // states that DO stay a plain customer: hasn't asked yet, or is
  // waiting on a pending/rejected request — both need a durable,
  // discoverable place to check status, not something they have to
  // remember was on the Overview page once.
  { href: "/dashboard/crm-access", label: "Request CRM Access" },
  { href: "/dashboard/profile", label: "Edit Profile", section: "Account" },
];

// Every staff level (rater/leader/group_leader) and admin gets this base
// set — day-to-day work, not org management. "Buy Plan for Customer" is
// here for everyone at this level too: starting an order for a customer
// who called in is a normal sales action, not a sensitive one.
const STAFF_BASE_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/crm", label: "My Leads", section: "Sales & Billing" },
  { href: "/dashboard/admin/buy-for-customer", label: "Buy Plan for Customer", section: "Sales & Billing" },
  { href: "/dashboard/invoices", label: "Order Invoices", section: "Sales & Billing" },
  { href: "/dashboard/invoice-crm", label: "Invoice CRM", section: "Sales & Billing" },
  { href: "/dashboard/orders", label: "Orders", section: "Sales & Billing" },
  // A staff member sees this too, not just customers — an accountant
  // invited onto a customer's Business Finance books (Module 12) needs
  // a way to reach them; for anyone not invited to any, the page itself
  // shows a plain "no access yet" state rather than a confusing prompt.
  // Only Reports joins it here — view_reports is the one permission
  // every book role has, so it's the only finance sub-page safe to put
  // in a nav that can't know the viewer's book-level role. The rest
  // (Import/Recurring/Budgets/Team/Activity/Settings) each need a
  // permission at least one role lacks, so they stay as buttons ON the
  // finance page, where `can(...)` actually hides them per role.
  { href: "/dashboard/finance", label: "Business Finance", section: "Sales & Billing" },
  { href: "/dashboard/finance/reports", label: "Finance Reports", section: "Sales & Billing" },
  { href: "/dashboard/attendance", label: "Attendance", section: "My Workspace" },
  // Split out from Attendance — a personal, paginated history of your
  // own correction requests (pending/approved/rejected), separate from
  // the team-wide review queue on the admin Team Attendance page.
  { href: "/dashboard/attendance/corrections", label: "Attendance Correction Requests", section: "My Workspace" },
  { href: "/dashboard/leave", label: "Leave", section: "My Workspace" },
  { href: "/dashboard/payslips", label: "My Payslips", section: "My Workspace" },
  { href: "/dashboard/holidays", label: "Holidays", section: "My Workspace" },
  { href: "/dashboard/documents", label: "Documents", section: "My Workspace" },
  // Viewable by every staff level — only admin can actually act on one
  // (enforced in the API and reflected in the page itself), but everyone
  // should be able to see what's pending.
  { href: "/dashboard/admin/account-requests", label: "Account Requests", section: "My Workspace" },
  // Read-only approved/rejected history — split into its own nav item
  // instead of a second table on the pending-queue page above.
  { href: "/dashboard/admin/reviewed-account-requests", label: "Reviewed Account Requests", section: "My Workspace" },
];

// Payroll/HR letters/reports/business settings are admin-only — matches
// the ADMIN_ONLY_SECTIONS guard in proxy.ts.
const ADMIN_ONLY_ITEMS: NavItem[] = [
  { href: "/dashboard/admin/employees", label: "Employees", section: "Administration", toolKey: "employees" },
  { href: "/dashboard/admin/departments", label: "Departments", section: "Administration", toolKey: "departments" },
  { href: "/dashboard/admin/payroll", label: "Payroll", section: "Administration", toolKey: "payroll" },
  { href: "/dashboard/admin/payslips", label: "Payslips", section: "Administration", toolKey: "payslips" },
  { href: "/dashboard/admin/hr-letters", label: "HR Letters", section: "Administration", toolKey: "hr_letters" },
  { href: "/dashboard/admin/product-catalog", label: "Invoice Item Catalog", section: "Administration", toolKey: "product_catalog" },
  { href: "/dashboard/admin/reports", label: "Data Exports", section: "Administration", toolKey: "reports" },
  // toolKey stays "company_settings" — it's a persisted staff_tool_grants
  // column value, not user-facing text, so it wasn't touched by the
  // "Company Settings" -> "Business Settings" rename.
  { href: "/dashboard/admin/business-settings", label: "Business Settings", section: "Administration", toolKey: "company_settings" },
  { href: "/dashboard/admin/email-failures", label: "Email Failures", section: "Administration", toolKey: "email_failures" },
  { href: "/dashboard/admin/leave-types", label: "Leave Types", section: "Administration", toolKey: "leave_types" },
  // Not itself delegable (Admin can already grant these individually
  // here) — org-admin only, matches proxy.ts's ADMIN_ONLY_SECTIONS.
  { href: "/dashboard/admin/activity", label: "Activity Log", section: "Administration" },
  { href: "/dashboard/admin/tool-access", label: "Delegated Access", section: "Administration" },
];

// Only a leader/group_leader/admin gets team-management views — a rater
// has no reports, so these pages would just be empty for them anyway
// (the API scopes by reporting chain), but hiding the nav link avoids the
// confusing "why is this blank" moment.
const TEAM_MANAGEMENT_ITEMS: NavItem[] = [
  { href: "/dashboard/admin/leads", label: "Team Leads CRM", section: "Team Management", toolKey: "leads_crm" },
  { href: "/dashboard/admin/attendance", label: "Team Attendance", section: "Team Management", toolKey: "team_attendance" },
  { href: "/dashboard/admin/leave-requests", label: "Team Leave Requests", section: "Team Management", toolKey: "team_leave" },
];

// Company-wide financials/headcount — group_leader and admin only.
const ANALYTICS_ITEM: NavItem = { href: "/dashboard/admin/analytics", label: "Analytics", section: "Team Management", toolKey: "analytics" };

const PROFILE_ITEM: NavItem = { href: "/dashboard/profile", label: "Edit Profile", section: "Account" };

// Legal Efilings operator only — a separate axis from account_type, so
// this shows up regardless of which org the platform_admin happens to
// belong to (see is_platform_admin, Phase 0 multi-tenancy migration).
// CRM Requests is its own item, not folded into Organizations — reviewing
// a customer's request for their own workspace is a distinct queue from
// managing the org list itself.
const PLATFORM_ITEMS: NavItem[] = [
  { href: "/dashboard/platform/organizations", label: "Organizations", section: "Platform" },
  { href: "/dashboard/platform/crm-requests", label: "CRM Requests", section: "Platform" },
];

// isManagerLevel comes from the staff member's assigned department_role
// (see 20260816000000_department_role_hierarchy.sql) — a company running
// its own "Lead / Manager / Senior Manager" ladder unlocks Team
// Management the same way leader/group_leader always has, without
// needing those exact three names.
function buildNavItems(profile: Profile, isManagerLevel: boolean, grantedTools: Set<ToolKey>): NavItem[] {
  // A customer account can never hold a delegated tool (see
  // hasToolAccess() in src/lib/tool-grants.ts) — real CRM capability for
  // a customer comes only from Request CRM Access, which promotes them
  // to admin of their own organization, a different branch below.
  if (!isStaffOrAdmin(profile)) return CUSTOMER_NAV_ITEMS;

  const isAdmin = profile.account_type === "admin";
  const items = [...STAFF_BASE_ITEMS];
  // Viewable by every staff level — admin creates the account directly,
  // anyone else submits a request instead (the page itself branches on
  // role); only the label here needs to match which one they'll see.
  items.push({ href: "/dashboard/admin/users", label: isAdmin ? "Create User" : "Request New User", section: "My Workspace" });

  // is_platform_admin included here too: after the reporting-chain fixes
  // in api/leads, api/attendance-corrections, api/leave-requests etc.,
  // a platform_admin now correctly gets full cross-org access on these
  // pages regardless of their own account_type/staff_level — the nav
  // needs to actually surface that, not just leave it reachable only by
  // typing the URL directly.
  if (isAdmin || isManagerLevel || profile.staff_level === "leader" || profile.staff_level === "group_leader" || profile.is_platform_admin) {
    items.push(...TEAM_MANAGEMENT_ITEMS);
  }
  if (isAdmin || profile.staff_level === "group_leader" || profile.is_platform_admin || grantedTools.has("analytics")) {
    items.push(ANALYTICS_ITEM);
  }
  if (isAdmin) {
    items.push(...ADMIN_ONLY_ITEMS);
  } else {
    // Non-admin: each admin-only section is individually delegable via
    // staff_tool_grants (an org admin granting one tool at a time,
    // see /dashboard/admin/tool-access) rather than all-or-nothing.
    for (const item of ADMIN_ONLY_ITEMS) {
      if (item.toolKey && grantedTools.has(item.toolKey)) items.push(item);
    }
  }
  if (profile.is_platform_admin) {
    items.push(...PLATFORM_ITEMS);
  }
  items.push(PROFILE_ITEM);
  return items;
}

const NAV_ICONS: Record<string, (props: { className?: string }) => React.JSX.Element> = {
  "/dashboard": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.5" />
      <rect x="13" y="10.5" width="7.5" height="10" rx="1.5" />
      <rect x="3.5" y="13.5" width="7.5" height="7" rx="1.5" />
    </svg>
  ),
  "/dashboard/crm": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c.7-3.6 3-5.5 5.5-5.5s4.8 1.9 5.5 5.5" strokeLinecap="round" />
      <circle cx="17" cy="7.5" r="2.25" />
      <path d="M15 14.2c2-.2 4 1.4 4.6 4.3" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/invoices": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M6 3.5h9l3 3V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5Z" strokeLinejoin="round" />
      <path d="M9 9h6M9 12.5h6M9 16h4" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/orders": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5Z" strokeLinejoin="round" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" strokeLinejoin="round" />
    </svg>
  ),
  "/dashboard/finance": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="6.5" width="17" height="12" rx="2" />
      <circle cx="12" cy="12.5" r="2.5" />
      <path d="M3.5 10h3M17.5 10h3M3.5 15h3M17.5 15h3" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/profile": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="8.5" r="3.25" />
      <path d="M5.5 20c1.2-3.5 4-5.5 6.5-5.5s5.3 2 6.5 5.5" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/attendance": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "/dashboard/attendance/corrections": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8 8.5h8M8 12h8M8 15.5h5" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/leave": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 3v3M16 3v3" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/admin/leads": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20c.7-3.6 3-5.5 5.5-5.5s4.8 1.9 5.5 5.5" strokeLinecap="round" />
      <circle cx="17" cy="7.5" r="2.25" />
      <path d="M15 14.2c2-.2 4 1.4 4.6 4.3" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/admin/account-requests": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="10" cy="8.5" r="3.25" />
      <path d="M3.5 20c1.1-3.5 3.8-5.5 6.5-5.5" strokeLinecap="round" />
      <path d="m15.5 15.5 2 2 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "/dashboard/admin/reviewed-account-requests": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8 8.5h8M8 12h8M8 15.5h5" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/admin/users": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="10" cy="8.5" r="3.25" />
      <path d="M3.5 20c1.1-3.5 3.8-5.5 6.5-5.5" strokeLinecap="round" />
      <path d="M18 9v6M15 12h6" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/admin/departments": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3.5 4 8v3l8 4.5 8-4.5V8l-8-4.5Z" strokeLinejoin="round" />
      <path d="M4 13v3l8 4.5 8-4.5v-3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "/dashboard/admin/employees": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 13h3M8 16h6" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/admin/attendance": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "/dashboard/admin/leave-requests": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 3v3M16 3v3" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/admin/analytics": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 20V10M11 20V4M18 20v-7" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/admin/buy-for-customer": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="9" cy="6.5" r="1.5" />
      <path d="M4 9.5h10l1.5 8a1 1 0 0 1-1 1.2H5.5a1 1 0 0 1-1-1.2Z" strokeLinejoin="round" />
      <path d="M17 13h4M19 11v4" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/payslips": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8 8h8M8 11.5h8M8 15h5" strokeLinecap="round" />
      <circle cx="16.5" cy="17" r="2.75" fill="currentColor" stroke="none" opacity="0.15" />
    </svg>
  ),
  "/dashboard/holidays": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 3v3M16 3v3" strokeLinecap="round" />
      <path d="M8 14l1.5 1.5L12.5 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "/dashboard/documents": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V4a.5.5 0 0 1 .5-.5Z" strokeLinejoin="round" />
      <path d="M14 3.5V8h4" strokeLinejoin="round" />
      <path d="M9.5 12.5h5M9.5 15.5h5" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/admin/hr-letters": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 6.5h16v11a.5.5 0 0 1-.5.5h-15a.5.5 0 0 1-.5-.5v-11Z" strokeLinejoin="round" />
      <path d="m4.5 6.5 7.5 6 7.5-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "/dashboard/admin/payroll": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v10M14.5 9.3c0-1-.9-1.8-2.5-1.8s-2.6.9-2.6 1.9c0 2.6 5.1 1.2 5.1 3.8 0 1-1 1.9-2.6 1.9s-2.5-.8-2.5-1.8" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/admin/payslips": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8 8h8M8 11.5h8M8 15h5" strokeLinecap="round" />
      <circle cx="16.5" cy="17" r="2.75" fill="currentColor" stroke="none" opacity="0.15" />
    </svg>
  ),
  "/dashboard/admin/reports": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 20V10M11 20V4M18 20v-7" strokeLinecap="round" />
      <path d="M3.5 20.5h17" strokeLinecap="round" />
    </svg>
  ),
  "/dashboard/platform/organizations": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  ),
  "/dashboard/admin/business-settings": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" strokeLinecap="round" />
    </svg>
  ),
};

// A rotating set of tints so the sidebar reads as colorful rather than
// one gray icon after another — each item's icon sits in its own tinted
// circle regardless of active state, keyed by position so it's stable
// across renders without needing per-route color assignments.
const ICON_TINTS = [
  { bg: "#fff1cc", fg: "#8a6700" },
  { bg: "#dbe7ff", fg: "#1d4fb8" },
  { bg: "#dcfce3", fg: "#116a2c" },
  { bg: "#fde2e2", fg: "#b42318" },
  { bg: "#ede9fe", fg: "#5b21b6" },
  { bg: "#fce7f3", fg: "#9d174d" },
  { bg: "#e0f2fe", fg: "#075985" },
];

// A personalized gradient initials avatar instead of the same generic
// brand mark (BrandFace) next to every single user's name — that's
// exactly the "same image for everyone" flatness this was meant to fix.
// Color is hashed from the name, so the same person always gets the same
// gradient rather than a random one on every render.
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #fdc500, #ff8a3d)",
  "linear-gradient(135deg, #60a5fa, #6366f1)",
  "linear-gradient(135deg, #34d399, #059669)",
  "linear-gradient(135deg, #f472b6, #db2777)",
  "linear-gradient(135deg, #a78bfa, #7c3aed)",
  "linear-gradient(135deg, #fb923c, #ea580c)",
];

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function ProfileAvatar({ name, className = "" }: { name: string; className?: string }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const gradient = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
      style={{ background: gradient }}
    >
      {initialsFor(name)}
    </span>
  );
}

const DEFAULT_NAV_ICON = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="12" r="8.5" />
  </svg>
);

// A freshly-constructed browser client's session isn't guaranteed to be
// hydrated from cookies yet on the very first call — most visible right
// after LoginForm's hard navigation into /dashboard, where this mounts
// on a brand-new page load a few milliseconds after the session cookie
// was written. A single getUser() call in that window can come back
// with no user even though proxy.ts's own (server-side, cookie-based)
// check just let the request through, incorrectly bouncing a real
// logged-in session back to /login. Retrying a couple of times over a
// short window absorbs that startup race without weakening the actual
// security boundary — this check is a client-side UX convenience only;
// every real authorization decision still happens server-side (proxy.ts,
// API routes) against the actual cookie, not this.
async function getUserWithRetry(supabase: ReturnType<typeof createSupabaseBrowserClient>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return user;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

// Sits INSIDE the normal site layout (header/footer/nav still render around
// it — see SiteChrome) rather than replacing it, so a logged-in client can
// still browse services, check pricing, and buy another plan without the
// dashboard being a walled-off silo. This component only supplies the
// account-area sidebar + content region + the demo auth guard.
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | "loading">("loading");
  // Which section's flyout is open, keyed by section name. The sidebar
  // is a fixed, always-open (never collapsed) labeled column — a grouped
  // item's links live in a hover/click-triggered popover next to its row
  // instead of expanding inline underneath it. Opening on hover is
  // debounced (openTimer, ~120ms) — an earlier version opened instantly
  // on mouseenter, so a flyout would flash open for every row the cursor
  // merely passed over on its way somewhere else. A short delay means
  // only a deliberate pause over a row opens it; a click also opens it
  // immediately for anyone who doesn't want to wait (or can't hover —
  // touch/keyboard).
  const [openFlyout, setOpenFlyout] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }
  function scheduleOpen(section: string) {
    clearTimers();
    openTimer.current = setTimeout(() => setOpenFlyout(section), 120);
  }
  function scheduleClose() {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpenFlyout(null), 150);
  }
  function toggleOpen(section: string) {
    clearTimers();
    setOpenFlyout((prev) => (prev === section ? null : section));
  }

  useEffect(() => clearTimers, []);

  useEffect(() => {
    if (!openFlyout) return;
    function handlePointerDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenFlyout(null);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [openFlyout]);

  useEffect(() => {
    // Deferred (not called synchronously in the effect body) — same pattern
    // used elsewhere in this codebase (CountdownTimer, AiAssistant) to avoid
    // the cascading-render lint rule.
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const user = await getUserWithRetry(supabase);
      if (!user) {
        router.replace("/login");
        return;
      }
      // department_roles!profiles_department_role_id_fkey — profiles has
      // two FKs to department_roles (this one, plus
      // department_roles.created_by pointing back at profiles), so an
      // unqualified embed is ambiguous (PGRST201) and fails outright,
      // which is what was actually sending real logged-in sessions back
      // to /login here — not a session/cookie timing issue.
      const { data: profile } = await supabase
        .from("profiles")
        .select("*, department_roles!profiles_department_role_id_fkey(title, is_manager_level), organizations!organization_id(name)")
        .eq("id", user.id)
        .single();
      if (!profile) {
        router.replace("/login");
        return;
      }
      const { department_roles, organizations, ...profileFields } = profile;
      // Own delegated-tool grants (staff_tool_grants RLS restricts this
      // select to the caller's own rows) — drives which admin-only nav
      // items show up for a non-admin who's been individually delegated
      // one, without exposing who else in the org has grants.
      const { data: grants } = await supabase.from("staff_tool_grants").select("tool_key, expires_at").eq("staff_id", user.id);
      const grantedTools = new Set<ToolKey>(
        (grants ?? []).filter((g) => isGrantActive(g)).map((g) => g.tool_key as ToolKey)
      );
      const orgRow = Array.isArray(organizations) ? (organizations[0] ?? null) : (organizations ?? null);
      setSession({
        name: profileFields.full_name ?? user.email ?? "Account",
        email: user.email ?? "",
        profile: { ...profileFields, email: user.email ?? "" },
        departmentRole: Array.isArray(department_roles) ? (department_roles[0] ?? null) : (department_roles ?? null),
        grantedTools,
        orgName: orgRow?.name ?? null,
      });
    }, 0);
    return () => clearTimeout(kickoff);
  }, [router]);

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const navItems =
    session !== "loading" && session !== null
      ? buildNavItems(session.profile, session.departmentRole?.is_manager_level ?? false, session.grantedTools)
      : CUSTOMER_NAV_ITEMS;

  // Two nav items can both be a prefix-match for the same URL — e.g.
  // "/dashboard/finance" (Business Finance) is itself a prefix of
  // "/dashboard/finance/reports" (Finance Reports), so a plain
  // pathname.startsWith(item.href) lit up both at once on the reports
  // page. Only the single longest (most specific) matching href should
  // ever be treated as active; every other item that merely matches as
  // a prefix stays inactive. "+ /" boundary check also stops
  // "/dashboard/lead" (hypothetical) from matching "/dashboard/leads".
  function hrefMatches(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  const bestHref = navItems.reduce<string | null>((best, item) => {
    if (!hrefMatches(item.href)) return best;
    if (!best || item.href.length > best.length) return item.href;
    return best;
  }, null);
  function isItemActive(item: NavItem) {
    return item.exact ? pathname === item.href : item.href === bestHref;
  }

  // "Section / Page" for the top bar — the sidebar already highlights the
  // active item, but that's scrolled out of view on any page long enough
  // to need it. Overview has no section (it's the one standalone item at
  // the top level), so it's shown alone rather than as "undefined / Overview".
  const activeNavItem = navItems.find((item) => isItemActive(item));
  const breadcrumb = activeNavItem ? (activeNavItem.section ? `${activeNavItem.section} / ${activeNavItem.label}` : activeNavItem.label) : null;

  // Collapses the flat navItems list into rail entries — a standalone
  // item (no section, e.g. Overview) becomes a direct-link rail icon; a
  // run of items sharing the same section becomes one rail icon whose
  // click opens a flyout with those items, instead of every individual
  // link getting its own row in an ever-taller sidebar.
  const railEntries: RailEntry[] = [];
  navItems.forEach((item, i) => {
    const Icon = NAV_ICONS[item.href] ?? DEFAULT_NAV_ICON;
    const tint = ICON_TINTS[i % ICON_TINTS.length];
    const active = isItemActive(item);
    if (!item.section) {
      railEntries.push({ type: "link", key: item.href, href: item.href, label: item.label, icon: Icon, tint, active });
      return;
    }
    const group = railEntries.find((e): e is Extract<RailEntry, { type: "group" }> => e.type === "group" && e.section === item.section);
    if (group) {
      group.items.push(item);
      if (active) group.active = true;
    } else {
      railEntries.push({ type: "group", key: item.section, section: item.section, items: [item], icon: Icon, tint, active });
    }
  });

  // Close whichever flyout is open when the route actually changes —
  // covers both "clicked a link inside it" (which already closes it
  // explicitly) and any other way the page could navigate.
  useEffect(() => {
    const kickoff = setTimeout(() => setOpenFlyout(null), 0);
    return () => clearTimeout(kickoff);
  }, [pathname]);

  if (session === "loading" || session === null) {
    return (
      <div>
        <div className="border-b" style={{ borderColor: "var(--color-line)" }}>
          <div className="mx-auto flex max-w-[1800px] items-center px-4 py-3 sm:px-6 lg:px-10">
            <Logo />
          </div>
        </div>
        <div className="mx-auto max-w-[1800px] px-4 pb-16 sm:px-6 lg:grid lg:grid-cols-[240px_1fr] lg:gap-6 lg:px-10">
          {/* A skeleton of the real nav, not a spinner alone — it previews
              the shape of what's coming so the switch to real content
              doesn't feel like a jump cut. */}
          <div className="hidden lg:block">
            <div className="flex flex-col gap-2 rounded-2xl border bg-white p-3 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-11 shrink-0 animate-pulse rounded-xl" style={{ backgroundColor: "var(--color-line)", opacity: 0.4, animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          </div>

          <BrandSpinner label="Preparing your dashboard…" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* The dashboard no longer sits inside the public site's header/
          promo-banner/mega-nav (see SiteChrome) — this is its own
          minimal replacement: just enough brand identity to know what
          app you're in, plus a persistent, obvious way out, without any
          of the marketing chrome that used to sit above every page. */}
      <div className="border-b" style={{ borderColor: "var(--color-line)" }}>
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/" aria-label="Legal Efilings — back to the main site" className="shrink-0">
              <Logo />
            </Link>
            {/* Where you are — the sidebar's own active-state highlight is
                the primary version of this, but it scrolls out of view on
                any page long enough to need reminding. Hidden below lg,
                where the mobile tab row just below already shows the
                current section. */}
            {breadcrumb && (
              <p className="hidden min-w-0 truncate text-sm font-medium lg:block" style={{ color: "var(--color-ink-soft)" }}>
                {breadcrumb}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {/* Which tenant's data is on screen. Worth stating plainly in
                this app specifically — a platform admin's pages pool every
                organization's records together, and a lot of this app's
                real bugs have come from exactly that boundary being
                implicit instead of visible.
                A real Link now, not a static span — a colored pill next to
                a button reads as clickable regardless of intent, and the
                one genuinely useful thing to do with "which orgs am I
                seeing" is jump straight to the Organizations list. */}
            {session.profile.is_platform_admin ? (
              <Link
                href="/dashboard/platform/organizations"
                className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors hover:brightness-95 sm:inline-flex"
                style={{ backgroundColor: "#ede9fe", color: "#5b21b6" }}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
                  <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
                  <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
                  <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
                </svg>
                All Organizations
              </Link>
            ) : (
              session.orgName && (
                <span
                  className="hidden max-w-[220px] items-center gap-1.5 truncate rounded-full px-3 py-1.5 text-xs font-semibold sm:inline-flex"
                  style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-action-dark)" }}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M5 20.5V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15.5M13 9.5h5a1 1 0 0 1 1 1v10" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 8h.01M8 11.5h.01M8 15h.01M16.5 13h.01M16.5 16.5h.01" strokeLinecap="round" />
                  </svg>
                  <span className="truncate">{session.orgName}</span>
                </span>
              )
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M15 4.5H8a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 8 19.5h7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M11 12h9.5m0 0-3-3m3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Log out
            </button>
          </div>
        </div>
      </div>

      {/* Same soft-yellow welcome band every other page's hero uses, so the
          dashboard reads as part of the site instead of a bolted-on app. */}
      <div style={{ background: "linear-gradient(180deg, var(--color-accent-tint) 0%, var(--color-paper) 100%)" }}>
        <div className="mx-auto max-w-[1800px] px-4 pt-10 pb-6 sm:px-6 lg:px-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-action-dark)" }}>
            Your Account
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <ProfileAvatar name={session.name} className="h-12 w-12 text-lg shadow-sm sm:h-14 sm:w-14" />
              <div>
                <h1 className="text-2xl font-extrabold sm:text-3xl" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
                  Welcome back, {session.name}
                </h1>
                <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>{roleLabel(session.profile, session.departmentRole?.title)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
            {/* Staff/admin already have "Buy Plan for Customer" in the
                sidebar nav — repeating it here as well read as redundant. */}
            {!isStaffOrAdmin(session.profile) && (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: "var(--color-action)" }}
              >
                Buy a New Plan
                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <ProfileCompletionBanner profile={session.profile} />
        <BusinessSettingsCompletionBanner profile={session.profile} />
      </div>

      <div className="mx-auto max-w-[1800px] px-4 pb-16 sm:px-6 lg:grid lg:grid-cols-[240px_1fr] lg:gap-6 lg:px-10">
        {/* Mobile: horizontal scrollable tab row instead of a duplicate off-canvas menu — the site header's own hamburger already covers site-wide nav. */}
        <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
          {navItems.map((item, i) => {
            const active = isItemActive(item);
            const Icon = NAV_ICONS[item.href] ?? DEFAULT_NAV_ICON;
            const tint = ICON_TINTS[i % ICON_TINTS.length];
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                style={
                  active
                    ? { backgroundColor: "var(--color-action)", borderColor: "var(--color-action)", color: "#fff" }
                    : { borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }
                }
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: active ? "rgba(255,255,255,0.2)" : tint.bg, color: active ? "#fff" : tint.fg }}
                >
                  <Icon className="h-3 w-3" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>

        <div
          className="mb-6 flex items-center gap-3 rounded-2xl border bg-white p-4 dark:bg-[var(--color-paper-raised)] lg:hidden"
          style={{ borderColor: "var(--color-line)" }}
        >
          <ProfileAvatar name={session.name} className="h-9 w-9 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
              {session.name}
            </p>
            <p className="truncate text-xs" style={{ color: "var(--color-ink-soft)" }}>
              {session.email} · {roleLabel(session.profile, session.departmentRole?.title)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--color-accent-tint)]"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M15 4.5H8a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 8 19.5h7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11 12h9.5m0 0-3-3m3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Fixed, always-open labeled width — no collapse toggle at all;
            grouped sections reveal their links in a hover-triggered
            flyout instead of expanding inline.
            sticky top-24: the page itself is the scrolling ancestor
            (normal document scroll), so the nav just stays pinned near
            the top of the viewport as you scroll `<main>`'s content
            past it, instead of owning its own separate scrollbox.
            z-40: establishing its own stacking context here (`relative`)
            means without an explicit z-index this whole subtree paints
            *underneath* the later `<main>` sibling wherever they
            visually overlap, which would make a flyout render behind
            page content instead of on top of it. */}
        <aside className="relative z-40 hidden lg:sticky lg:top-24 lg:block lg:self-start">
          <nav
            ref={navRef}
            className="flex flex-col gap-1 rounded-2xl border bg-white p-2.5 dark:bg-[var(--color-paper-raised)]"
            style={{ borderColor: "var(--color-line)" }}
          >
            {railEntries.map((entry) => {
              const Icon = entry.icon;
              const rowStyle = entry.active
                ? { backgroundColor: "var(--color-accent-tint)", color: "var(--color-ink)" }
                : { color: "var(--color-ink-soft)" };

              if (entry.type === "link") {
                return (
                  <Link
                    key={entry.key}
                    href={entry.href}
                    className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--color-muted-tint)]"
                    style={rowStyle}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-150 group-hover:scale-110"
                      style={{ backgroundColor: entry.tint.bg, color: entry.tint.fg }}
                    >
                      <Icon className="h-[16px] w-[16px]" />
                    </span>
                    <span className="truncate">{entry.label}</span>
                  </Link>
                );
              }

              const isOpen = openFlyout === entry.section;
              return (
                <div
                  key={entry.key}
                  className="relative"
                  onMouseEnter={() => scheduleOpen(entry.section)}
                  onMouseLeave={scheduleClose}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleOpen(entry.section)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleOpen(entry.section);
                      }
                    }}
                    aria-expanded={isOpen}
                    // outline-none + focus-visible:ring replaces the
                    // browser's default focus ring — that default ring
                    // rendering on top of the isOpen background tint is
                    // what made an open row look like two different
                    // things were highlighted at once.
                    className="group flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium outline-none transition-colors hover:bg-[var(--color-muted-tint)] focus-visible:ring-2 focus-visible:ring-[var(--color-action)]"
                    style={isOpen ? { backgroundColor: "var(--color-accent-tint)", color: "var(--color-ink)" } : rowStyle}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-150 group-hover:scale-110"
                      style={{ backgroundColor: entry.tint.bg, color: entry.tint.fg }}
                    >
                      <Icon className="h-[16px] w-[16px]" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{entry.section}</span>
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  {isOpen && (
                    // The 8px gap to the trigger row used to be a plain
                    // `ml-2` margin on the card below — real empty space
                    // that belongs to neither the trigger nor the flyout.
                    // Moving the mouse diagonally toward an item lower in
                    // the list (the natural path) crossed that dead zone,
                    // fired a genuine mouseleave, and — if the cursor
                    // lingered there at all — closed the flyout before it
                    // was reached, forcing a re-hover to open it again.
                    // Padding instead of margin keeps the same visual
                    // offset but makes that space part of this outer
                    // element's own hoverable box, so crossing it no
                    // longer leaves the hover target at all.
                    <div className="absolute left-full top-0 z-30 w-60 pl-2">
                      <div
                        className="rounded-2xl border bg-white shadow-xl dark:bg-[var(--color-paper-raised)]"
                        style={{ borderColor: "var(--color-line)" }}
                      >
                        {/* max-h caps a long flyout (e.g. Administration's
                            10 items) instead of letting it run off the
                            bottom of the viewport; overflow-y-auto + the
                            bottom fade below are the cue that there's more
                            to scroll to, since a plain clipped list gives
                            no such signal on its own. */}
                        <div className="max-h-[70vh] overflow-y-auto p-2">
                          <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
                            {entry.section}
                          </p>
                          {entry.items.map((item, j) => {
                          const ItemIcon = NAV_ICONS[item.href] ?? DEFAULT_NAV_ICON;
                          const itemTint = ICON_TINTS[j % ICON_TINTS.length];
                          const itemActive = isItemActive(item);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setOpenFlyout(null)}
                              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors ${itemActive ? "" : "hover:bg-[var(--color-muted-tint)]"}`}
                              style={itemActive ? { backgroundColor: "var(--color-accent-tint)", color: "var(--color-ink)" } : { color: "var(--color-ink-soft)" }}
                            >
                              <span
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                                style={{ backgroundColor: itemTint.bg, color: itemTint.fg }}
                              >
                                <ItemIcon className="h-3.5 w-3.5" />
                              </span>
                              {item.label}
                            </Link>
                          );
                          })}
                        </div>
                        {entry.items.length > 6 && (
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-6 rounded-b-2xl"
                            style={{ background: "linear-gradient(180deg, transparent, var(--color-paper-raised))" }}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div
            className="mt-4 flex items-center gap-2.5 rounded-2xl border bg-white p-2.5 dark:bg-[var(--color-paper-raised)]"
            style={{ borderColor: "var(--color-line)" }}
          >
            <ProfileAvatar name={session.name} className="h-9 w-9 shrink-0 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" style={{ color: "var(--color-ink)" }}>{session.name}</p>
              <p className="truncate text-xs" style={{ color: "var(--color-ink-soft)" }}>{roleLabel(session.profile, session.departmentRole?.title)}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--color-accent-tint)]"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M15 4.5H8a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 8 19.5h7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M11 12h9.5m0 0-3-3m3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </aside>

        {/* min-w-0 is load-bearing: a grid item's default min-width is
            "auto", which lets it grow to fit a wide child (the leads/
            invoices tables) instead of respecting the grid track — a
            wide table scrolls horizontally inside its own
            overflow-x-auto container (see DataTable) rather than
            stretching this column and pushing the page wider. */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
