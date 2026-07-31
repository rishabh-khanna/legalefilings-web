"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteSearch } from "@/components/SiteSearch";
import { Logo } from "@/components/Logo";
import { PriceTagBadge } from "@/components/PriceTagBadge";
import { CountdownTimer } from "@/components/CountdownTimer";
import type { SearchEntry } from "@/lib/content";
import { CONTACT_LINKS } from "@/config/site";
import { CATEGORY_ICONS } from "@/components/CategoryIcons";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type NavCategoryData = {
  label: string;
  items: { slug: string; title: string }[];
};

export function SiteHeader({ categories, searchIndex }: { categories: NavCategoryData[]; searchIndex: SearchEntry[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const router = useRouter();

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setLoggedIn(false);
    setOpen(false);
    router.push("/login");
    router.refresh();
  }

  // Swaps "Sign In" for "Dashboard" once a real session exists, so a
  // logged-in visitor can get back to it from anywhere on the public site
  // instead of the dashboard being a dead end.
  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setLoggedIn(Boolean(user));
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  // The header's real height (it varies with font-load reflow, the mobile
  // hamburger menu opening, viewport width, etc.) is published as a CSS
  // variable so any other sticky element below it — like the in-page section
  // nav — can offset by the actual value instead of a hardcoded guess that
  // drifts out of sync and clips content underneath the header.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const setVar = () => document.documentElement.style.setProperty("--header-height", `${el.offsetHeight}px`);
    setVar();
    const observer = new ResizeObserver(setVar);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The mobile menu is a fixed dropdown panel anchored below the header
  // (not translated off-screen when closed — conditionally mounted instead
  // — so it can't trigger the horizontal-overflow quirk a translate-based
  // drawer can). Locking the page behind it and letting Escape close it
  // matches every other overlay in this codebase (search, quote modal).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-20 border-b shadow-[0_1px_2px_rgba(15,23,42,0.03),0_4px_20px_rgba(15,23,42,0.05)]"
      style={{ borderColor: "var(--color-line)", backgroundColor: "var(--color-accent-tint)" }}
    >
      {/* Offer strip — the whole composition (rotated price-tag badge, bold
          headline + short description, a real countdown, a pill CTA) is
          referenced from doola.com's own top banner. Copy is our own real,
          verifiable number (the highest discount actually listed on any of
          our pricing pages), not a fabricated promo, and the countdown
          resets nightly rather than pointing at a fake one-time deadline.
          Collapsed while the mobile menu is open — the promo isn't worth
          the vertical space it eats from an already-tight phone screen
          when the visitor is actively trying to navigate. */}
      <div
        className={`${open ? "hidden lg:flex" : "flex"} flex-wrap items-center justify-center gap-x-5 gap-y-1.5 px-4 py-2.5 text-center sm:py-3`}
        style={{ backgroundColor: "var(--color-banner)" }}
      >
        <PriceTagBadge label="50% OFF" sub="UP TO" />
        <div className="text-left">
          <p className="text-sm font-bold text-white sm:text-lg">Our Best Prices Yet: Register Your Business Today!</p>
          <p className="text-xs text-white/60 sm:text-sm">Save up to 50% on select registrations — government fees included.</p>
        </div>
        <CountdownTimer />
        <Link
          href="/contact"
          onClick={() => setOpen(false)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.03]"
          style={{ backgroundColor: "var(--color-accent)", color: "var(--color-ink-fixed)" }}
        >
          Claim My Offer
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* Secondary bar — "Already have an account?" on one side, "Any
          questions?" on the other, referenced from doola.com's own header
          (it sits above the main nav on every page, not just the home). */}
      <div
        className="hidden items-center justify-between px-4 py-1.5 text-xs sm:flex"
        style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-ink-soft)" }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-end gap-6">
          <span>
            {loggedIn ? (
              <>
                You&apos;re signed in.{" "}
                <Link href="/dashboard" className="font-semibold" style={{ color: "var(--color-action-dark)" }}>
                  Go to Dashboard →
                </Link>{" "}
                <button type="button" onClick={handleLogout} className="font-semibold underline" style={{ color: "var(--color-ink-soft)" }}>
                  Logout
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link href="/login" className="font-semibold" style={{ color: "var(--color-action-dark)" }}>
                  Sign In →
                </Link>
              </>
            )}
          </span>
          <span className="hidden md:inline">
            Any questions?{" "}
            <a href={CONTACT_LINKS.tel} className="font-semibold" style={{ color: "var(--color-action-dark)" }}>
              Talk to Experts
            </a>
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="shrink-0" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        {/* Desktop nav with hover dropdowns */}
        <nav className="hidden lg:flex items-center gap-5 text-sm font-medium">
          {categories.map((cat) => (
            <div key={cat.label} className="group relative">
              <button className="relative flex items-center gap-1 whitespace-nowrap py-2 text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]">
                {cat.label}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-hover:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span
                  aria-hidden="true"
                  className="absolute -bottom-0.5 left-0 h-0.5 w-full origin-center scale-x-0 rounded-full transition-transform duration-200 group-hover:scale-x-100"
                  style={{ backgroundColor: "var(--color-action)" }}
                />
              </button>
              <div className="invisible absolute left-0 top-full z-10 w-64 translate-y-1 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <div
                  className="overflow-hidden rounded-xl border py-2 shadow-[0_4px_6px_rgba(15,23,42,0.03),0_16px_32px_rgba(15,23,42,0.10)]"
                  style={{ borderColor: "var(--color-line)", backgroundColor: "var(--color-paper-raised)" }}
                >
                  {cat.items.map((item) => (
                    <Link
                      key={item.slug}
                      href={`/services/${item.slug}`}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors hover:bg-[var(--color-accent-tint)]"
                      style={{ color: "var(--color-ink)" }}
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "var(--color-action)" }} />
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
          <Link
            href="/pricing"
            className="whitespace-nowrap py-2 text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
          >
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <SiteSearch index={searchIndex} />
          <span aria-hidden="true" className="hidden h-6 w-px lg:block" style={{ backgroundColor: "var(--color-line)" }} />
          {/* A single CTA in the nav row — doola.com's own header only ever
              shows one ("Book a Free Consultation"), not two competing
              buttons; the second one here was just adding width that made
              the row wrap on real-world screen sizes. */}
          <Link
            href="/contact"
            className="hidden sm:inline-block rounded-full px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: "var(--color-ink-fixed)" }}
            onClick={() => setOpen(false)}
          >
            Start Your Business
          </Link>
          {/* Hamburger */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors hover:bg-white/60"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
          >
            {open ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu — a left-anchored sidebar (not a full-width dropdown),
          fixed and bounded to the space between the header and the fixed
          Call/WhatsApp bar so the last category can't get physically
          covered by it, with a CTA footer that's always visible without
          scrolling to reach it. Only ever mounted while open — never
          sitting off-screen at a permanent negative offset — so the
          slide-in animation can't reintroduce the horizontal-overflow bug
          an always-mounted, permanently-translated drawer caused earlier
          (see globals.css's sidebar-in keyframes for the full note). */}
      {open && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          />
          <nav
            aria-label="Mobile menu"
            className="animate-sidebar-in fixed left-0 z-40 flex w-[85%] max-w-xs flex-col rounded-r-2xl border-r shadow-2xl lg:hidden"
            style={{
              top: "var(--header-height)",
              maxHeight: "calc(100dvh - var(--header-height) - 3.75rem)",
              borderColor: "var(--color-line)",
              backgroundColor: "var(--color-paper-raised)",
            }}
          >
            <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--color-line)" }}>
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
                Menu
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--color-accent-tint)]"
                style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-3">
              <Link
                href="/pricing"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
                style={{ color: "var(--color-ink)" }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-action-dark)" }}
                >
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M12 2 3 6.5v5c0 5.2 3.7 9 9 10.5 5.3-1.5 9-5.3 9-10.5v-5L12 2Z" strokeLinejoin="round" />
                    <path d="M9.5 12h5M12 9.5v5" strokeLinecap="round" />
                  </svg>
                </span>
                Pricing
              </Link>

              <div className="my-2 h-px" style={{ backgroundColor: "var(--color-line)" }} />

              <div className="space-y-1">
                {categories.map((cat) => {
                  const isExpanded = expanded === cat.label;
                  const Icon = CATEGORY_ICONS[cat.label];
                  return (
                    <div key={cat.label}>
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => setExpanded(isExpanded ? null : cat.label)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
                        style={{ color: "var(--color-ink)" }}
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: "var(--color-accent-tint)", color: "var(--color-action-dark)" }}
                        >
                          {Icon && <Icon className="h-[18px] w-[18px]" />}
                        </span>
                        <span className="flex-1">{cat.label}</span>
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-4 w-4 shrink-0 transition-transform duration-150"
                          style={{ color: "var(--color-ink-soft)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {isExpanded && (
                        <div className="ml-[3.25rem] mt-0.5 space-y-0.5 border-l pl-3" style={{ borderColor: "var(--color-line)" }}>
                          {cat.items.map((item) => (
                            <Link
                              key={item.slug}
                              href={`/services/${item.slug}`}
                              onClick={() => setOpen(false)}
                              className="block rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-[var(--color-accent-tint)]"
                              style={{ color: "var(--color-ink-soft)" }}
                            >
                              {item.title}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="my-2 h-px" style={{ backgroundColor: "var(--color-line)" }} />

              <Link
                href={loggedIn ? "/dashboard" : "/login"}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--color-accent-tint)]"
                style={{ color: "var(--color-ink-soft)" }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--color-paper)", color: "var(--color-ink-soft)" }}
                >
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <circle cx="12" cy="8.5" r="3.25" />
                    <path d="M5.5 20c1.2-3.5 4-5.5 6.5-5.5s5.3 2 6.5 5.5" strokeLinecap="round" />
                  </svg>
                </span>
                {loggedIn ? "Dashboard" : "Login"}
              </Link>
              {loggedIn && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--color-accent-tint)]"
                  style={{ color: "var(--color-ink-soft)" }}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "var(--color-paper)", color: "var(--color-ink-soft)" }}
                  >
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <path d="M15 4.5H8a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 8 19.5h7" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M11 12h9.5m0 0-3-3m3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  Logout
                </button>
              )}
            </div>

            <div className="mt-auto flex shrink-0 gap-3 border-t p-4" style={{ borderColor: "var(--color-line)" }}>
              <a
                href={CONTACT_LINKS.tel}
                className="flex-1 rounded-full border px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-[var(--color-accent-tint)]"
                style={{ borderColor: "var(--color-ink)", color: "var(--color-ink)" }}
              >
                Talk to Experts
              </a>
              <Link
                href="/contact"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full px-4 py-2.5 text-center text-sm font-semibold text-white"
                style={{ backgroundColor: "var(--color-ink-fixed)" }}
              >
                Start Your Business
              </Link>
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
