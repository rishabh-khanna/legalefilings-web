"use client";

import { usePathname } from "next/navigation";
import { SiteHeader, type NavCategoryData } from "@/components/SiteHeader";
import { FloatingContact } from "@/components/FloatingContact";
import { AiAssistant } from "@/components/AiAssistant";
import type { SearchEntry } from "@/lib/content";

// doola.com's real sign-in/signup pages are standalone — no offer banner,
// no mega-menu nav, no footer, just the two-panel auth layout itself. Our
// /login page already built that same two-panel layout, but the global
// header/footer from the root layout were still rendering above and below
// it, which is the actual structural mismatch (not a color/spacing one).
// This client boundary lets the root layout stay a server component while
// still being able to check the current route and skip the site chrome
// for pages that shouldn't have it.
//
// /dashboard deliberately does NOT get this treatment (even though it's a
// logged-in area) — a client who's signed in should still be able to
// browse services, see pricing, and buy another plan without leaving the
// dashboard section, so it keeps the full public header/nav/footer around
// it rather than being walled off in its own silo.
const BARE_ROUTES = ["/login"];

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

  if (bare) {
    return <main className="flex-1">{children}</main>;
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
