"use client";

import { useState } from "react";
import Link from "next/link";
import type { PricingPlan } from "@/lib/content";
import { PricingPlans } from "@/components/PricingPlans";
import { SectionHeading } from "@/components/SectionHeading";

export type CarouselService = {
  slug: string;
  title: string;
  plans: PricingPlan[];
  /** Shown as a small badge next to the title — used for the one service we actually sell the most of, so a visitor browsing the homepage sees it called out rather than having to already know. */
  bestseller?: boolean;
};

// A handful of real bestseller services, browsable right on the homepage
// with prev/next arrows instead of committing the whole section to one
// static service — the full catalog still lives on /pricing.
export function HomePricingCarousel({ services }: { services: CarouselService[] }) {
  const [index, setIndex] = useState(0);
  const service = services[index];
  if (!service) return null;

  const go = (delta: number) => setIndex((i) => (i + delta + services.length) % services.length);

  return (
    <div>
      <p className="text-center text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: "var(--color-muted-dark)" }}>
        Pricing
      </p>

      <div className="text-center">
        <SectionHeading align="center">
          Start with <span className="text-gradient">{service.title}</span>
        </SectionHeading>
        {service.bestseller && (
          <span
            className="mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
            style={{ backgroundColor: "var(--color-accent)", color: "var(--color-ink)" }}
          >
            ⭐ Bestseller
          </span>
        )}
      </div>

      <p className="mt-2 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
        {services.length > 1 ? "Browse our most-registered services — see every plan on the full pricing page." : "See every service's pricing on the full plans page."}
      </p>

      <div className="mt-3 flex justify-center gap-1.5">
        {services.map((s, i) => (
          <button
            key={s.slug}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show ${s.title} pricing`}
            aria-current={i === index}
            className="h-1.5 rounded-full transition-all"
            style={{ width: i === index ? 20 : 6, backgroundColor: i === index ? "var(--color-action)" : "var(--color-line)" }}
          />
        ))}
      </div>

      {/* Prev/next sit right against the plan cards, not up near the
          heading — they were easy to miss as small outline buttons next
          to the title, so now they're large, solid, shadowed circles
          flanking the grid itself, impossible to mistake for decoration. */}
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous plan"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-lg transition-transform hover:scale-110 dark:bg-[var(--color-paper-raised)] sm:h-12 sm:w-12"
          style={{ color: "var(--color-ink)", border: "1px solid var(--color-line)" }}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.25">
            <path d="M12.5 5 7.5 10l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <PricingPlans plans={service.plans} showHeading={false} sectionId="home-pricing" serviceTitle={service.title} />
        </div>

        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next plan"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-lg transition-transform hover:scale-110 dark:bg-[var(--color-paper-raised)] sm:h-12 sm:w-12"
          style={{ color: "var(--color-ink)", border: "1px solid var(--color-line)" }}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.25">
            <path d="m7.5 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="mt-2 text-center">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: "var(--color-ink-fixed)" }}
        >
          See All Plans &amp; Pricing
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
