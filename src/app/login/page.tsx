import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS_STATS, SITE_NAME } from "@/config/site";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/LoginForm";
import { TrustBadge } from "@/components/TrustBadge";
import { DemoLoginCredentials } from "@/components/DemoLoginCredentials";

export const metadata: Metadata = {
  title: `Login — ${SITE_NAME}`,
  description: `Client login for ${SITE_NAME} — coming soon.`,
};

const CHECKLIST = [
  "CA & CS-reviewed filings, not a script",
  "One point of contact, start to finish",
  "Most registrations move in days, not weeks",
];

// Split-panel layout referenced from doola.com's own sign-in page: a yellow
// gradient brand panel on the left (logo + headline + real Trustpilot
// rating), a white form panel on the right with an offer card above the
// fields. doola's left panel also rotates real customer testimonials —
// we don't have any on file for LegalEfilings, so instead of inventing
// quotes it shows our own real, verifiable stats and the same claims used
// in the "Why Choose Us" section on the homepage.
export default function LoginPage() {
  return (
    // Grid columns stretch to match each other by default — the right
    // column's real height (name/email/phone/password fields + footer
    // links) is taller than one screen, so the left
    // column's yellow background correctly stretches to match it too (this
    // is what makes it reach the bottom instead of stopping short). What
    // shouldn't stretch is the CONTENT inside the left column: it used to
    // be spread across that same full height via justify-between, which
    // pushed the trust badge down along with it, off the first screen. The
    // badge now sits in the normal document flow right after the
    // checklist instead, so it's always near the top, visible without
    // scrolling, regardless of how tall the right column ends up being.
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className="relative hidden flex-col overflow-hidden p-12 lg:flex"
        style={{ background: "linear-gradient(160deg, var(--color-accent-tint) 0%, var(--color-accent) 100%)" }}
      >
        {/* Decorative depth — a couple of soft, oversized circles bleeding
            off the panel edges, clipped by overflow-hidden above. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full"
          style={{ backgroundColor: "rgba(15,23,42,0.06)" }}
        />

        <Link href="/" aria-label="Back to homepage" className="relative">
          <Logo />
        </Link>

        <div className="relative mt-16">
          <h1
            className="max-w-sm text-4xl font-extrabold leading-tight"
            style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}
          >
            Register your business with confidence
          </h1>

          <div className="mt-8 grid grid-cols-2 gap-4 max-w-sm">
            <div className="rounded-2xl bg-white/70 p-4">
              <p className="text-2xl font-extrabold" style={{ color: "var(--color-ink)" }}>{BUSINESS_STATS.businessesServed}</p>
              <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Businesses registered</p>
            </div>
            <div className="rounded-2xl bg-white/70 p-4">
              <p className="text-2xl font-extrabold" style={{ color: "var(--color-ink)" }}>{BUSINESS_STATS.caCsProfessionals}</p>
              <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>CA &amp; CS professionals</p>
            </div>
          </div>

          <ul className="mt-6 max-w-sm space-y-2.5">
            {CHECKLIST.map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--color-ink)" }}>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  className="mt-0.5 h-4 w-4 flex-none"
                  fill="none"
                  stroke="var(--color-ink)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="10" cy="10" r="8.5" fill="rgba(255,255,255,0.55)" stroke="none" />
                  <path d="M6.5 10.3l2.3 2.3 4.7-5" />
                </svg>
                {line}
              </li>
            ))}
          </ul>

          <TrustBadge className="relative mt-8" />
        </div>
      </div>

      <div className="flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 lg:hidden">
            <Link
              href="/"
              aria-label="Back to homepage"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--color-accent-tint)]"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link href="/" aria-label="Back to homepage">
              <Logo />
            </Link>
          </div>
          <h2
            className="mt-6 text-2xl font-extrabold lg:mt-0"
            style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}
          >
            Welcome back
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: "var(--color-ink-soft)" }}>
            Please sign in to your account, or{" "}
            <Link href="/contact" className="font-medium" style={{ color: "var(--color-action-dark)" }}>
              get in touch
            </Link>{" "}
            to open one.
          </p>

          <div
            className="mt-6 flex items-center gap-3 rounded-2xl border p-4"
            style={{ borderColor: "var(--color-line)", backgroundColor: "var(--color-accent-tint)" }}
          >
            <span className="text-xl" aria-hidden="true">🎉</span>
            <p className="text-sm" style={{ color: "var(--color-ink)" }}>
              <span className="font-semibold">Save up to 50% on select registrations.</span>{" "}
              Sign in to see your quote.
            </p>
          </div>

          <LoginForm />

          <p className="mt-4 text-center text-xs" style={{ color: "var(--color-ink-soft)" }}>
            New here?{" "}
            <Link href="/manual" target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: "var(--color-action-dark)" }}>
              Read the user manual
            </Link>{" "}
            to see what each account type can do.
          </p>

          <DemoLoginCredentials />
        </div>
      </div>
    </div>
  );
}
