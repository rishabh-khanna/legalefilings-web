"use client";

import { useEffect, useState } from "react";
import { BUSINESS_STATS } from "@/config/site";

// The hero's right-side visual — referenced from doola.com's own homepage
// (a "compliance checklist" product mockup with a person overlaid, plus a
// floating stat chip). Both mockups are commissioned AI-generated
// illustrations provided for this purpose, not photos of real people or
// stock images — the floating stat chip below them is real data, not part
// of the illustration. Cross-fades between the two on a timer.
const SLIDES = [
  { src: "/images/hero-mockup-1.png", alt: "Legal Efilings client compliance dashboard mockup" },
  { src: "/images/hero-mockup-2.png", alt: "Legal Efilings financial compliance dashboard mockup" },
];

const SLIDE_INTERVAL_MS = 4500;

export function HeroMockup() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((i) => (i + 1) % SLIDES.length);
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative">
      <div className="relative h-64 w-full overflow-hidden rounded-[2rem] shadow-[0_1px_2px_rgba(15,23,42,0.06),0_24px_48px_rgba(15,23,42,0.14)] sm:h-72">
        {SLIDES.map((slide, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            width={1536}
            height={1024}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out"
            style={{ opacity: i === active ? 1 : 0 }}
          />
        ))}

        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {SLIDES.map((slide, i) => (
            <span
              key={slide.src}
              aria-hidden="true"
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === active ? "1.25rem" : "0.375rem",
                backgroundColor: i === active ? "white" : "rgba(255,255,255,0.55)",
              }}
            />
          ))}
        </div>
      </div>

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
