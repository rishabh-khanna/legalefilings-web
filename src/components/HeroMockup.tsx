import { BUSINESS_STATS } from "@/config/site";

// The hero's right-side visual — referenced from doola.com's own homepage
// (a "compliance checklist" product mockup with a person overlaid, plus a
// floating stat chip). The mockup itself (tracker card + activity panel +
// person) is a commissioned AI-generated illustration provided for this
// purpose, not a photo of a real person or a stock image — the floating
// stat chip below it is real data, not part of the illustration.
export function HeroMockup() {
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/hero-mockup.png"
        alt="Legal Efilings case tracker mockup"
        width={1672}
        height={941}
        className="h-64 w-full rounded-[2rem] object-cover shadow-[0_1px_2px_rgba(15,23,42,0.06),0_24px_48px_rgba(15,23,42,0.14)] sm:h-72"
      />

      <div
        className="absolute -bottom-5 -left-4 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_28px_rgba(15,23,42,0.12)] sm:-left-6"
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
          {BUSINESS_STATS.businessesServed}
          <br />
          <span className="font-normal" style={{ color: "var(--color-ink-soft)" }}>businesses registered</span>
        </p>
      </div>
    </div>
  );
}
