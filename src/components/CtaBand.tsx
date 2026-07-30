import Link from "next/link";
import { BUSINESS_PHONE, CONTACT_LINKS } from "@/config/site";
import { FORM_COPY } from "@/config/copy";
import { TrackingGraphic } from "@/components/TrackingGraphic";

export function CtaBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-16">
      <div
        className="grid overflow-hidden rounded-3xl lg:grid-cols-2"
        style={{ backgroundColor: "var(--color-ink-fixed)" }}
      >
        <div className="flex flex-col justify-center px-8 py-12 text-center lg:items-start lg:text-left">
          <h2
            className="text-3xl font-semibold text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Ready to start your business?
          </h2>
          <p className="mt-3 max-w-xl text-white/70">
            Talk to a CA today — free consultation, transparent pricing, and your
            registration handled end to end.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link
              href="/contact"
              className="rounded-full px-6 py-3 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(37,99,235,0.2),0_4px_12px_rgba(37,99,235,0.3)] transition-transform hover:scale-[1.03]"
              style={{ backgroundColor: "var(--color-action)" }}
            >
              {FORM_COPY.submitLabel}
            </Link>
            <a
              href={CONTACT_LINKS.tel}
              className="rounded-full border border-white/25 px-6 py-3 text-sm font-medium text-white hover:bg-white/10"
            >
              Call {BUSINESS_PHONE.display}
            </a>
          </div>
        </div>

        <div
          className="relative hidden items-end overflow-hidden lg:flex"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
          />
          <TrackingGraphic className="h-full w-full" style={{ color: "var(--color-action)" }} />
          <div
            className="absolute right-6 top-6 flex items-center gap-2.5 rounded-2xl bg-white dark:bg-[var(--color-paper-raised)] px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_28px_rgba(15,23,42,0.12)]"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--color-action-tint)" }}
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="var(--color-action-dark)" strokeWidth="2">
                <circle cx="10" cy="10" r="8.5" />
                <path d="m6.5 10.5 2.3 2.3 4.7-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="text-sm font-semibold leading-tight" style={{ color: "var(--color-ink)" }}>
              100% Confidential
              <br />
              <span className="font-normal" style={{ color: "var(--color-ink-soft)" }}>No spam, ever</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
