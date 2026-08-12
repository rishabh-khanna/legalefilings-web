"use client";

import { isValidElement, type ReactNode } from "react";
import { PageHelpButton } from "@/components/dashboard/PageHelpButton";

// Every dashboard page wraps its title/subtitle/KPIs here, so this one
// component sets the tone for the whole logged-in product.
//
// It used to be a saturated cream->gold gradient with two blurred glow
// orbs behind it. That reads as decoration competing with content: on a
// dense page the loudest thing on screen was the band that carries the
// least information, and repeating it on all 45 pages made the product
// feel like a template. This version keeps the warmth but spends it
// differently — a near-white surface, one hairline of real gold at the
// top edge, and a very soft radial wash that you notice only if you look
// for it. The hierarchy is carried by type and space; the gold is a
// signature, not a fill.
export function DashboardPageHero({
  title,
  subtitle,
  action,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className="relative mb-6 overflow-hidden rounded-[22px] border px-6 pb-6 pt-[1.375rem]"
      style={{
        // The warm cream->gold band is the product's signature and it
        // stays. An earlier pass flattened this to near-white in the name
        // of restraint and the result read as dead — on a page that is
        // otherwise white cards on a near-white canvas, this band is the
        // only thing carrying brand warmth, so removing it removed the
        // personality without buying any legibility (the text on it
        // measures 15:1 either way). Same gradient, retuned onto the new
        // gold ramp so it's honeyed rather than acidic.
        // Ends on #f9e8bd rather than gold-200 (#f6dfa2): the subtitle
        // runs in --color-ink-soft, which measures 4.36:1 on gold-200 —
        // just under the 4.5:1 floor. Two shades lighter and it clears at
        // 4.71:1 with no visible loss of warmth.
        background: "linear-gradient(135deg, var(--gold-50) 0%, var(--gold-100) 52%, #f9e8bd 100%)",
        borderColor: "var(--gold-200)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ backgroundColor: "var(--color-accent)", opacity: 0.22 }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 left-1/4 h-48 w-48 rounded-full blur-3xl"
        style={{ backgroundColor: "var(--color-action)", opacity: 0.1 }}
      />

      <div className="relative">
        <div className="flex items-center gap-1.5">
          <h2
            className="text-[1.375rem] font-bold leading-tight"
            style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)", letterSpacing: "-0.019em" }}
          >
            {title}
          </h2>
          <PageHelpButton />
        </div>
        {subtitle && (
          <p className="mt-1.5 max-w-3xl text-[0.8125rem] leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
            {subtitle}
          </p>
        )}
        {/* action always sits in its own row below the subtitle, never
            floated top-right — that used to wrap onto its own line
            anyway whenever a page's subtitle was long enough to fill
            the row (as on Payroll), landing at an inconsistent spot
            depending on subtitle length even though it was always
            structurally inside this box. A fixed row is predictable on
            every page regardless of subtitle length. */}
        {action && <div className="mt-4">{action}</div>}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

// The page's primary add/apply control. Solid brand yellow carrying ink
// text rather than white-on-gold: it's the logo's own relationship
// (yellow field, black wordmark), it measures 9.9:1 where white on gold
// manages 4.6:1, and in a product where every other button is neutral it
// makes the one real call to action on a page unmissable without being
// loud.
export function HeroAction({ icon: Icon, children, ...props }: { icon?: React.ComponentType<{ className?: string }>; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="group inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.8125rem] font-semibold transition-all duration-150 hover:-translate-y-px active:translate-y-0 disabled:pointer-events-none disabled:opacity-55"
      style={{
        backgroundColor: "var(--color-accent)",
        color: "var(--color-ink)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      {Icon && <Icon className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" />}
      {children}
    </button>
  );
}

// A plain, non-interactive stat tile — icon, number, label. Used to open
// a popup listing the underlying rows when clicked, but that affordance
// wasn't discoverable (nothing about a stat card looks clickable) and
// wasn't being used, so every call site now just shows the number.
export function HeroKpi({
  icon,
  label,
  value,
  suffix,
}: {
  // A component reference (the common case — every client-component
  // page passes e.g. `icon={Users}`) or an already-rendered element (the
  // one Server Component call site, the Overview page, since a bare
  // function reference can't cross the server→client boundary as a prop
  // the way an already-rendered element can).
  icon: React.ComponentType<{ className?: string }> | ReactNode;
  label: string;
  value: React.ReactNode;
  suffix?: string;
}) {
  // Can't check `typeof icon === "function"` — lucide-react icons (the
  // overwhelming majority of callers) are forwardRef objects, not plain
  // functions, so that check silently misclassified every one of them
  // as "already an element" and tried to render the un-instantiated
  // component reference directly (React: "Objects are not valid as a
  // React child"). isValidElement is the actual right test: true only
  // for the output of JSX/createElement, never for a component
  // reference itself, regardless of how that component was defined.
  const Icon = isValidElement(icon) ? null : (icon as React.ComponentType<{ className?: string }>);

  return (
    <div
      className="group rounded-[16px] border p-4 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        borderColor: "var(--color-line)",
        backgroundColor: "color-mix(in srgb, var(--color-paper-raised) 82%, transparent)",
        backdropFilter: "blur(6px)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      {/* Filled with real accent, not a pale tint. The tint version read
          as a disabled control — on a white tile inside a gold band, a
          washed-out icon has nothing to hold onto. This is one of the few
          places a saturated fill earns its keep: it's small, it repeats
          in a rhythm, and ink-on-accent measures 9.9:1. */}
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full shadow-sm transition-transform duration-200 group-hover:scale-105"
        style={{ backgroundColor: "var(--color-accent)", color: "var(--color-ink)" }}
      >
        {Icon ? <Icon className="h-4 w-4" /> : (icon as ReactNode)}
      </span>
      <p
        className="mt-3 text-2xl font-bold tabular-nums"
        style={{ color: "var(--color-ink)", letterSpacing: "-0.02em" }}
      >
        {value}
        {suffix}
      </p>
      <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>
        {label}
      </p>
    </div>
  );
}
