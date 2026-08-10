"use client";

import { usePathname } from "next/navigation";
import { SiteHeader, type NavCategoryData } from "@/components/SiteHeader";
import { FloatingContact } from "@/components/FloatingContact";
import { AiAssistant } from "@/components/AiAssistant";
import { DashboardHelpAssistant } from "@/components/dashboard/DashboardHelpAssistant";
import type { SearchEntry } from "@/lib/content";

// doola.com's real sign-in/signup pages are standalone — no offer banner,
// no mega-menu nav, no footer, just the two-panel auth layout itself. Our
// /login page already built that same two-panel layout, but the global
// header/footer from the root layout were still rendering above and below
// it, which is the actual structural mismatch (not a color/spacing one).
// This client boundary lets the root layout stay a server component while
// still being able to check the current route and skip the site chrome
// for pages that shouldn't have it.
// /manual is a fully self-contained reference document with its own
// masthead, sidebar nav, and typography — the marketing header/promo
// banner/footer above and below it were pure noise on a page meant to
// be read start to finish, same reasoning as /login below.
// /forgot-password and /reset-password are the same auth flow as
// /login — a centered card, not a page meant to be browsed alongside a
// "Claim My Offer" countdown banner and mega-nav. They were left off
// this list when it was first written, so the offer banner and full
// marketing header still rendered above the reset-password card even
// though /login right next to it already didn't have that problem.
const BARE_ROUTES = ["/login", "/manual", "/forgot-password", "/reset-password"];

// /dashboard used to deliberately keep the full public header/promo
// banner/mega-nav/footer around it, on the theory that a signed-in
// client should be able to browse services or buy another plan without
// leaving the dashboard section. In practice a countdown-timer offer
// banner and "Claim My Offer" CTA sitting above a staff member's lead
// list (or a customer's invoice) reads as noise, not a feature — and
// it's the one part of the page whose height actually varies, which is
// what made the dashboard feel inconsistent page to page. The CRM now
// gets its own clean shell: no header/promo/nav/footer, but the
// floating support contact stays (a real, low-noise way to reach a
// human, unlike the marketing chrome around it).
const DASHBOARD_PREFIX = "/dashboard";

export function SiteChrome({
  navCategories,
  searchIndex,
  children,
  footer,
}: {
  navCategories: NavCategoryData[];
  searchIndex: SearchEntry[];
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const bare = BARE_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isDashboard = pathname === DASHBOARD_PREFIX || pathname.startsWith(`${DASHBOARD_PREFIX}/`);

  if (bare) {
    return <main className="flex-1">{children}</main>;
  }

  if (isDashboard) {
    return (
      <>
        <main key="main" className="flex-1">{children}</main>
        <FloatingContact key="floating" />
        <DashboardHelpAssistant key="help" />
      </>
    );
  }

  return (
    <>
      <SiteHeader key="header" categories={navCategories} searchIndex={searchIndex} />
      <main key="main" className="flex-1">{children}</main>
      <FloatingContact key="floating" />
      <AiAssistant key="ai" searchIndex={searchIndex} />
      {footer}
    </>
  );
}
