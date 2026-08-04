import type { ReactNode } from "react";

// A warm cream→gold gradient hero (with soft blurred glow orbs) — every
// dashboard page wraps its title/subtitle/KPIs in this instead of a
// plain white header, so the whole logged-in area reads as one
// consistent system rather than two different-looking sections bolted
// together. Previously a dark navy panel; switched to this light
// brand-gold treatment since the dark block read as an odd, out-of-place
// slab against the rest of the (light) dashboard.
export function DashboardPageHero({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
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
        <h2 className="text-2xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

export function HeroKpi({ icon: Icon, label, value, suffix }: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; suffix?: string }) {
  return (
    <div
      className="rounded-2xl border bg-white/70 p-4 backdrop-blur-xl transition-transform hover:-translate-y-0.5"
      style={{ borderColor: "var(--color-line)" }}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: "var(--color-accent)", color: "var(--color-ink)" }}>
        <Icon className="h-4 w-4" />
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
