"use client";

import { isValidElement, type ReactNode } from "react";
import { PageHelpButton } from "@/components/dashboard/PageHelpButton";

// A warm cream→gold gradient hero (with soft blurred glow orbs) — every
// dashboard page wraps its title/subtitle/KPIs in this instead of a
// plain white header, so the whole logged-in area reads as one
// consistent system rather than two different-looking sections bolted
// together. Previously a dark navy panel; switched to this light
// brand-gold treatment since the dark block read as an odd, out-of-place
// slab against the rest of the (light) dashboard.
// `action` is the page's one primary "+ Add X" / "+ Apply for X" control
// — rendered top-right, next to the title, instead of its own row below
// the hero. Keeps it in a fixed, predictable spot regardless of how much
// KPI/summary content a page puts in `children`: a row placed after the
// hero drifts further down the page as that content grows (this is what
// happened on the Leave page once balance cards were added above it,
// pushing "+ Apply for Leave" down far enough to crowd the fixed
// help/WhatsApp widgets in the corner). Use HeroAction for it, which
// gives it a lighter outlined style than a full solid-fill button — a
// routine "add one row" action doesn't need the same visual weight as a
// page's main call to action.
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
      className="relative mb-6 overflow-hidden rounded-[28px] border p-6"
      style={{
        background: "linear-gradient(135deg, #fffaf0 0%, #fef2d4 55%, #fce4ad 100%)",
        borderColor: "var(--color-accent-tint)",
      }}
    >
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ backgroundColor: "var(--color-accent)", opacity: 0.25 }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-20 left-1/4 h-48 w-48 rounded-full blur-3xl"
        style={{ backgroundColor: "var(--color-action)", opacity: 0.12 }}
      />
      <div className="relative">
        <div className="flex items-center gap-1.5">
          <h2 className="text-2xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
            {title}
          </h2>
          <PageHelpButton />
        </div>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
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

// Shared lighter style for a hero's primary add/apply action — an
// outlined pill instead of a solid fill, so it reads as "a normal
// control up here" rather than competing with the page's real CTAs.
export function HeroAction({ icon: Icon, children, ...props }: { icon?: React.ComponentType<{ className?: string }>; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="inline-flex items-center gap-1.5 rounded-full border bg-white/70 px-4 py-2 text-sm font-semibold backdrop-blur-xl transition-colors hover:bg-white disabled:opacity-60"
      style={{ borderColor: "var(--color-accent)", color: "var(--color-ink)" }}
    >
      {Icon && <Icon className="h-4 w-4" />}
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
    <div className="rounded-2xl border bg-white/70 p-4 backdrop-blur-xl transition-transform hover:-translate-y-0.5" style={{ borderColor: "var(--color-line)" }}>
      <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: "var(--color-accent)", color: "var(--color-ink)" }}>
        {Icon ? <Icon className="h-4 w-4" /> : (icon as ReactNode)}
      </span>
      <p className="mt-3 text-2xl font-extrabold" style={{ color: "var(--color-ink)" }}>
        {value}
        {suffix}
      </p>
      <p className="text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>
        {label}
      </p>
    </div>
  );
}
