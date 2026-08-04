"use client";

import { useState } from "react";
import type { PricingPlan } from "@/lib/content";
import { openQuoteModal } from "@/lib/quote-modal";
import { openPaymentModal } from "@/lib/payment-modal";
import { SectionHeading } from "@/components/SectionHeading";

// A small rotating set of plan icons — referenced from doola.com's own
// pricing cards (rocket / lightning-bolt / cube, one per tier) — cycled by
// position since our plan counts vary page to page (2 tiers on some pages,
// 12 on the ISO certification page) rather than doola's fixed 3.
const PLAN_ICONS: ((props: { className?: string }) => React.JSX.Element)[] = [
  ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 2c2.5 2 4 5.5 4 9 0 2-.5 3.5-1 5l-3 3-3-3c-.5-1.5-1-3-1-5 0-3.5 1.5-7 4-9Z" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="1.75" />
      <path d="M8.5 15 6 21l2.5-1.5M15.5 15 18 21l-2.5-1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" stroke="none">
      <path d="M13 2 3 14h7l-1 8 11-14h-7l1-6Z" />
    </svg>
  ),
  ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3 4 7v10l8 4 8-4V7Z" strokeLinejoin="round" />
      <path d="M4 7l8 4 8-4M12 11v10" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  ),
];

export function PricingPlans({
  plans,
  showHeading = true,
  sectionId = "pricing",
  serviceTitle,
}: {
  plans: PricingPlan[];
  /** Set false when composing several services' plans on one page (e.g. /pricing) — the caller renders its own heading instead. */
  showHeading?: boolean;
  /** Each PricingPlans on a page needs a unique id for #anchor links — override when more than one appears on the same page. */
  sectionId?: string;
  /** Passed through to the quote modal so the lead record says which service the plan is for — required on pages that list more than one service's plans (e.g. /pricing), where QuoteModal can't assume a single static service. */
  serviceTitle?: string;
}) {
  // The highlighted card starts on the first plan (shown as "Most Popular")
  // but is really a selection — clicking any other plan moves the highlight
  // there instead of leaving it stuck on the first one.
  const [selected, setSelected] = useState(0);
  const [userSelected, setUserSelected] = useState(false);

  if (plans.length === 0) return null;

  return (
    // The my-14/mt-10 spacing below is sized for this section standing
    // alone with its own heading (homepage, a single service page). When
    // composed many times per page without a heading (e.g. /pricing, which
    // stacks one of these under every service's own h3), that spacing
    // doubled up with the caller's own margin and produced a large empty
    // gap above every single card grid — tightened here instead of via the
    // caller working around it.
    <section id={sectionId} className={`${showHeading ? "my-14" : "mb-10"} scroll-mt-nav px-4 sm:px-0`}>
      {showHeading && (
        <>
          <p
            className="text-center text-xs font-semibold uppercase tracking-[0.15em]"
            style={{ color: "var(--color-muted-dark)" }}
          >
            Pricing
          </p>
          <SectionHeading align="center" wrapperClassName="mt-2">
            Simple packages. Transparent <span className="text-gradient">pricing</span>.
          </SectionHeading>
          <p className="mt-2 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
            Every plan includes government fee guidance and expert support end to end.
          </p>
        </>
      )}
      <div className={`${showHeading ? "mt-10" : "mt-5"} grid gap-6 sm:grid-cols-2 lg:grid-cols-3`}>
        {plans.map((plan, i) => {
          const featured = i === selected;
          const selectThis = () => {
            setSelected(i);
            setUserSelected(true);
          };
          const Icon = PLAN_ICONS[i % PLAN_ICONS.length];
          const priceNow = plan.price.replace(/\+.*$/, "").trim();
          const priceWas = plan.originalPrice?.replace(/\+.*$/, "").trim();

          return (
            <div
              key={`${plan.name}-${i}`}
              role="button"
              tabIndex={0}
              aria-pressed={featured}
              onClick={selectThis}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectThis();
                }
              }}
              className="flex cursor-pointer flex-col overflow-hidden rounded-[32px] text-left transition-shadow duration-200"
              style={{
                boxShadow: featured
                  ? "0 2px 8px rgba(0,0,0,0.06), 0 20px 40px rgba(0,0,0,0.10)"
                  : "0 1px 2px rgba(15,23,42,0.04), 0 8px 20px rgba(15,23,42,0.05)",
              }}
            >
              {/* Top band — referenced from doola.com's own pricing cards
                  (a colored label band above each tier, solid-filled on the
                  "Most Popular" one, a lighter tint on the others). */}
              <p
                className="px-4 py-2 text-center text-sm font-medium"
                style={{
                  backgroundColor: featured ? "var(--color-accent)" : "var(--color-accent-tint)",
                  color: "var(--color-ink)",
                }}
              >
                {featured ? (userSelected ? "Selected" : "Most Popular") : plan.name}
              </p>

              <div
                className="flex flex-1 flex-col p-7"
                style={{ backgroundColor: featured ? "var(--color-accent-tint)" : "var(--color-paper-raised)" }}
              >
                <Icon className="h-7 w-7" />
                <h3 className="mt-4 font-extrabold text-xl" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
                  {plan.name}
                </h3>
                {plan.description && (
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-ink-soft)" }}>
                    {plan.description}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-baseline gap-2">
                  {priceWas && (
                    <span className="text-base line-through" style={{ color: "var(--color-ink-soft)" }}>
                      {priceWas}
                    </span>
                  )}
                  <span className="text-3xl font-extrabold" style={{ color: "var(--color-ink)" }}>
                    {priceNow}
                  </span>
                  {plan.discount && (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: "#d0f4db", color: "#116a2c" }}
                    >
                      {plan.discount}
                    </span>
                  )}
                </div>
                {/\+/.test(plan.price) && (
                  <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>+ Govt. fee extra</p>
                )}

                {/* One unified checklist — tick for included, cross for
                    excluded — instead of two separately-headed "what's
                    included" / "what's not" sections. Full list, no
                    scroll/truncation: cards in the same row still stretch
                    to equal height (CSS grid default) and the spacer
                    below pins every button to the same baseline, so a
                    shorter tier just gets a bit of open space above its
                    button instead of a cramped scroll box. */}
                {(plan.features.length > 0 || (plan.excludedFeatures?.length ?? 0) > 0) && (
                  <ul className="mt-6 space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2" style={{ color: "var(--color-ink)" }}>
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 20 20"
                          className="mt-0.5 h-4 w-4 shrink-0"
                          fill="none"
                          stroke="var(--color-action-dark)"
                          strokeWidth="2.5"
                        >
                          <path d="m4 10.5 3.5 3.5L16 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {f}
                      </li>
                    ))}
                    {plan.excludedFeatures?.map((f) => (
                      <li key={f} className="flex items-start gap-2" style={{ color: "var(--color-ink-soft)" }}>
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 20 20"
                          className="mt-0.5 h-4 w-4 shrink-0"
                          fill="none"
                          stroke="#dc2626"
                          strokeWidth="2.5"
                        >
                          <path d="m6 6 8 8M14 6l-8 8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Cards in the same row stretch to equal height by default
                    (CSS grid), but nothing was claiming the extra space —
                    shorter cards just left their button wherever their own
                    content ended. This spacer absorbs it so every button
                    lines up. */}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectThis();
                    openPaymentModal({ plan: { name: plan.name, price: priceNow }, service: serviceTitle ?? plan.name });
                  }}
                  className="mt-7 block rounded-full py-3 text-center text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                  style={{ backgroundColor: "var(--color-action)" }}
                >
                  Pay Now
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    selectThis();
                    openQuoteModal({ plan: { name: plan.name, price: priceNow }, service: serviceTitle });
                  }}
                  className="mt-2 block rounded-full py-3 text-center text-sm font-semibold transition-colors hover:bg-black/5"
                  style={{ border: "1px solid var(--color-ink-fixed)", color: "var(--color-ink-fixed)" }}
                >
                  Get a Quote
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
