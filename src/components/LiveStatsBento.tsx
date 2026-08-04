"use client";

import { useEffect, useRef, useState } from "react";
import { BUSINESS_STATS } from "@/config/site";

// Counts up from 0 to `target` once the tile scrolls into view — a small,
// tasteful bit of motion instead of a static number, triggered by
// IntersectionObserver rather than on mount so it plays when a visitor
// actually scrolls to it.
function CountUp({ target, suffix = "", duration = 1400 }: { target: number; suffix?: string; duration?: number }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || played.current) return;
        played.current = true;
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(target * eased));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return (
    <span ref={ref}>
      {value.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

const BUSINESSES_TARGET = Number(BUSINESS_STATS.businessesServed.replace(/\D/g, ""));
const EXPERTS_TARGET = Number(BUSINESS_STATS.caCsProfessionals.replace(/\D/g, ""));

// An asymmetric "bento" grid instead of another row of identical cards —
// one big headline stat, two supporting stats, one wide qualitative tile.
// Mixed tile sizes plus the count-up motion is meant to read as a single
// deliberate "by the numbers" moment rather than one more feature-card row.
export function LiveStatsBento() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:grid-rows-2">
        <div
          className="col-span-2 row-span-2 flex flex-col justify-between rounded-[28px] p-8"
          style={{ background: "linear-gradient(135deg, var(--color-ink-fixed) 0%, #1e293b 100%)" }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="var(--color-accent)" strokeWidth="1.5">
            <path d="M4 21V7l6-3v17M4 21h16M10 4l6 3v14M14 21V10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="text-5xl font-extrabold sm:text-6xl" style={{ color: "#fff", fontFamily: "var(--font-display)" }}>
              <CountUp target={BUSINESSES_TARGET} suffix="+" />
            </p>
            <p className="mt-2 text-sm font-medium text-white/70">Businesses registered and supported across India</p>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-[28px] p-6" style={{ backgroundColor: "var(--color-accent)" }}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="var(--color-ink)" strokeWidth="1.75">
            <circle cx="9" cy="8" r="3" />
            <path d="M3.5 20c.7-3.6 3-5.5 5.5-5.5s4.8 1.9 5.5 5.5" strokeLinecap="round" />
            <circle cx="17" cy="7.5" r="2.25" />
            <path d="M15 14.2c2-.2 4 1.4 4.6 4.3" strokeLinecap="round" />
          </svg>
          <div>
            <p className="text-3xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
              <CountUp target={EXPERTS_TARGET} suffix="+" />
            </p>
            <p className="mt-1 text-xs font-semibold" style={{ color: "var(--color-ink)" }}>In-house CA/CS experts</p>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-[28px] border bg-white p-6 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="var(--color-action-dark)" strokeWidth="1.75">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.5 3.8 8.5s-1.3 6.1-3.8 8.5c-2.5-2.4-3.8-5.5-3.8-8.5s1.3-6.1 3.8-8.5Z" />
          </svg>
          <div>
            <p className="text-lg font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
              Pan-India
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>Filings handled in every state</p>
          </div>
        </div>

        <div
          className="col-span-2 flex items-center justify-between gap-4 rounded-[28px] p-6"
          style={{ backgroundColor: "var(--color-accent-tint)" }}
        >
          <div>
            <p className="text-lg font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
              Government fees included
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>The price you see is the price you pay — no surprise add-ons later.</p>
          </div>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-9 w-9 shrink-0" fill="none" stroke="var(--color-action-dark)" strokeWidth="1.5">
            <path d="M12 3 4 7v10l8 4 8-4V7Z" strokeLinejoin="round" />
            <path d="m8.5 12 2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </section>
  );
}
