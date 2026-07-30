"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { BrandFace } from "@/components/BrandFace";
import { clearDemoSession, getDemoSession, type DemoSession } from "@/lib/demo-auth";

const NAV_ITEMS: { href: string; label: string; exact?: boolean }[] = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/crm", label: "CRM" },
  { href: "/dashboard/invoices", label: "Invoices" },
  { href: "/dashboard/orders", label: "Order History" },
  { href: "/dashboard/profile", label: "Edit Profile" },
];

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
};

// Sits INSIDE the normal site layout (header/footer/nav still render around
// it — see SiteChrome) rather than replacing it, so a logged-in client can
// still browse services, check pricing, and buy another plan without the
// dashboard being a walled-off silo. This component only supplies the
// account-area sidebar + content region + the demo auth guard.
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<DemoSession | null | "loading">("loading");

  useEffect(() => {
    // Deferred (not called synchronously in the effect body) — same pattern
    // used elsewhere in this codebase (CountdownTimer, AiAssistant) to avoid
    // the cascading-render lint rule.
    const kickoff = setTimeout(() => {
      const s = getDemoSession();
      if (!s) {
        router.replace("/login");
        return;
      }
      setSession(s);
    }, 0);
    return () => clearTimeout(kickoff);
  }, [router]);

  function handleLogout() {
    clearDemoSession();
    router.push("/login");
  }

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
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-16 lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        {/* Mobile: horizontal scrollable tab row instead of a duplicate off-canvas menu — the site header's own hamburger already covers site-wide nav. */}
        <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
          {NAV_ITEMS.map((item) => {
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

        <aside className="hidden lg:block">
          <nav className="flex flex-col gap-1 rounded-2xl border bg-white p-3 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
            {NAV_ITEMS.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const Icon = NAV_ICONS[item.href];
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

        <main>{children}</main>
      </div>
    </div>
  );
}
