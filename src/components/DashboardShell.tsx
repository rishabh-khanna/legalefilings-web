"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { BrandFace } from "@/components/BrandFace";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isStaffOrAdmin, roleLabel, type Profile } from "@/lib/roles";

type Session = { name: string; email: string; profile: Profile };
type NavItem = { href: string; label: string; exact?: boolean };

const CUSTOMER_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/invoices", label: "My Invoices" },
  { href: "/dashboard/orders", label: "Order History" },
  { href: "/dashboard/profile", label: "Edit Profile" },
];

// Every staff level (rater/leader/group_leader) and admin gets this base
// set — day-to-day work, not org management. "Buy Plan for Customer" is
// here for everyone at this level too: starting an order for a customer
// who called in is a normal sales action, not a sensitive one.
const STAFF_BASE_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/crm", label: "My Leads" },
  { href: "/dashboard/admin/buy-for-customer", label: "Buy Plan for Customer" },
  { href: "/dashboard/invoices", label: "Invoices" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/attendance", label: "Attendance" },
  { href: "/dashboard/leave", label: "Leave" },
  // Viewable by every staff level — only admin can actually act on one
  // (enforced in the API and reflected in the page itself), but everyone
  // should be able to see what's pending.
  { href: "/dashboard/admin/account-requests", label: "Account Requests" },
];

// Only a leader/group_leader/admin gets team-management views — a rater
// has no reports, so these pages would just be empty for them anyway
// (the API scopes by reporting chain), but hiding the nav link avoids the
// confusing "why is this blank" moment.
const TEAM_MANAGEMENT_ITEMS: NavItem[] = [
  { href: "/dashboard/admin/leads", label: "Team Leads CRM" },
  { href: "/dashboard/admin/attendance", label: "Team Attendance" },
  { href: "/dashboard/admin/leave-requests", label: "Team Leave Requests" },
];

// Company-wide financials/headcount — group_leader and admin only.
const ANALYTICS_ITEM: NavItem = { href: "/dashboard/admin/analytics", label: "Analytics" };

const PROFILE_ITEM: NavItem = { href: "/dashboard/profile", label: "Edit Profile" };

function buildNavItems(profile: Profile): NavItem[] {
  if (!isStaffOrAdmin(profile)) return CUSTOMER_NAV_ITEMS;

  const isAdmin = profile.account_type === "admin";
  const items = [...STAFF_BASE_ITEMS];
  // Viewable by every staff level — admin creates the account directly,
  // anyone else submits a request instead (the page itself branches on
  // role); only the label here needs to match which one they'll see.
  items.push({ href: "/dashboard/admin/users", label: isAdmin ? "Create User" : "Request New User" });

  if (isAdmin || profile.staff_level === "leader" || profile.staff_level === "group_leader") {
    items.push(...TEAM_MANAGEMENT_ITEMS);
  }
  if (isAdmin || profile.staff_level === "group_leader") {
    items.push(ANALYTICS_ITEM);
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
  "/dashboard/admin/users": ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="10" cy="8.5" r="3.25" />
      <path d="M3.5 20c1.1-3.5 3.8-5.5 6.5-5.5" strokeLinecap="round" />
      <path d="M18 9v6M15 12h6" strokeLinecap="round" />
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
};

const DEFAULT_NAV_ICON = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="12" cy="12" r="8.5" />
  </svg>
);

// Sits INSIDE the normal site layout (header/footer/nav still render around
// it — see SiteChrome) rather than replacing it, so a logged-in client can
// still browse services, check pricing, and buy another plan without the
// dashboard being a walled-off silo. This component only supplies the
// account-area sidebar + content region + the demo auth guard.
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | "loading">("loading");

  useEffect(() => {
    // Deferred (not called synchronously in the effect body) — same pattern
    // used elsewhere in this codebase (CountdownTimer, AiAssistant) to avoid
    // the cascading-render lint rule.
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (!profile) {
        router.replace("/login");
        return;
      }
      setSession({ name: profile.full_name ?? user.email ?? "Account", email: user.email ?? "", profile: { ...profile, email: user.email ?? "" } });
    }, 0);
    return () => clearTimeout(kickoff);
  }, [router]);

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const navItems = session !== "loading" && session !== null ? buildNavItems(session.profile) : CUSTOMER_NAV_ITEMS;

  if (session === "loading" || session === null) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Same soft-yellow welcome band every other page's hero uses, so the
          dashboard reads as part of the site instead of a bolted-on app. */}
      <div style={{ background: "linear-gradient(180deg, var(--color-accent-tint) 0%, var(--color-paper) 100%)" }}>
        <div className="mx-auto max-w-6xl px-4 pt-10 pb-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-action-dark)" }}>
            Your Account
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-extrabold sm:text-3xl" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
              Welcome back, {session.name}
            </h1>
            {/* Staff/admin already have "Buy Plan for Customer" in the
                sidebar nav — repeating it here as well read as redundant. */}
            {!isStaffOrAdmin(session.profile) && (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                style={{ backgroundColor: "var(--color-ink-fixed)" }}
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

      <div className="mx-auto max-w-6xl px-4 pb-16 lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        {/* Mobile: horizontal scrollable tab row instead of a duplicate off-canvas menu — the site header's own hamburger already covers site-wide nav. */}
        <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                style={
                  active
                    ? { backgroundColor: "var(--color-ink-fixed)", borderColor: "var(--color-ink-fixed)", color: "#fff" }
                    : { borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div
          className="mb-6 flex items-center gap-3 rounded-2xl border bg-white p-4 dark:bg-[var(--color-paper-raised)] lg:hidden"
          style={{ borderColor: "var(--color-line)" }}
        >
          <BrandFace className="h-9 w-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
              {session.name}
            </p>
            <p className="truncate text-xs" style={{ color: "var(--color-ink-soft)" }}>
              {session.email} · {roleLabel(session.profile)}
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

        <aside className="hidden lg:block">
          <nav className="flex flex-col gap-1 rounded-2xl border bg-white p-3 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
            {navItems.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = NAV_ICONS[item.href] ?? DEFAULT_NAV_ICON;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
                  style={
                    active
                      ? { backgroundColor: "var(--color-accent-tint)", color: "var(--color-ink)" }
                      : { color: "var(--color-ink-soft)" }
                  }
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div
            className="mt-4 flex items-center gap-3 rounded-2xl border bg-white p-4 dark:bg-[var(--color-paper-raised)]"
            style={{ borderColor: "var(--color-line)" }}
          >
            <BrandFace className="h-9 w-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                {session.name}
              </p>
              <p className="truncate text-xs" style={{ color: "var(--color-ink-soft)" }}>
                {session.email}
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
        </aside>

        {/* min-w-0 is load-bearing: a grid item's default min-width is
            "auto", which lets it grow to fit a wide child (the leads/
            invoices tables) instead of respecting the grid track — that
            expands the whole page rather than letting the table's own
            overflow-x-auto container scroll internally, which is what
            made the right side of wide tables unreachable. */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
