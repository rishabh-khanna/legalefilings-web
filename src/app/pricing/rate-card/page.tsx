"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, CreditCard } from "lucide-react";
import { FEE_SCHEDULE } from "@/content/fee-schedule";
import { SectionHeading } from "@/components/SectionHeading";
import { GlowBadge } from "@/components/CategoryIcons";
import { QuoteModal } from "@/components/QuoteModal";
import { PaymentModal } from "@/components/PaymentModal";
import { openQuoteModal } from "@/lib/quote-modal";
import { openPaymentModal } from "@/lib/payment-modal";
import { CONTACT_LINKS, CONTACT_EMAIL, SITE_DOMAIN, BUSINESS_PHONE, SITE_NAME } from "@/config/site";

// A single flat "₹1,234" figure is the only kind of price a Pay Now button
// can charge — items priced "As actual", "As per requirement", or as a
// percentage keep Get Quote as their only action, same rule FeeSchedule uses.
const FLAT_PRICE = /^₹[\d,]+$/;

const TRUST_POINTS = [
  {
    label: "Transparent Pricing",
    icon: ({ className }: { className?: string }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M12 3 4 7v10l8 4 8-4V7Z" strokeLinejoin="round" />
        <path d="m8.5 12 2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Expert Advice",
    icon: ({ className }: { className?: string }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 20c1.3-4 4.2-6 7.5-6s6.2 2 7.5 6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Pan India Services",
    icon: ({ className }: { className?: string }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.5 3.8 8.5s-1.3 6.1-3.8 8.5c-2.5-2.4-3.8-5.5-3.8-8.5s1.3-6.1 3.8-8.5Z" />
      </svg>
    ),
  },
  {
    label: "End to End Solutions",
    icon: ({ className }: { className?: string }) => (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function RateCardPage() {
  // Only the first category opens by default — ~70 line items across 7
  // categories all expanded at once was the whole reason this page felt
  // like a wall of text. Multiple categories can be open together
  // (independent toggles, not an exclusive accordion), so browsing a
  // couple of related ones side by side still works.
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set([FEE_SCHEDULE[0]?.title ?? ""]));

  function toggle(title: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  return (
    <div>
      <div style={{ background: "linear-gradient(180deg, var(--color-accent-tint) 0%, var(--color-paper) 100%)" }}>
        <div className="mx-auto max-w-5xl px-4 pt-14 pb-10 text-center">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-sm font-medium"
            style={{ color: "var(--color-action-dark)" }}
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12.5 5 7.5 10l5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Plans &amp; Pricing
          </Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-action-dark)" }}>
            {SITE_NAME} · Helping Startups
          </p>
          <SectionHeading align="center" wrapperClassName="mt-2">
            Complete <span className="text-gradient">Price List</span>
          </SectionHeading>
          <p className="mx-auto mt-3 max-w-xl text-sm" style={{ color: "var(--color-ink-soft)" }}>
            Every registration, license, and compliance filing we offer — flat fees, nothing hidden. Tap a category to expand it, pay online right from here.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pb-20">
        <div className="mt-4 space-y-4">
          {FEE_SCHEDULE.map((category) => {
            const isOpen = openCategories.has(category.title);
            return (
              <div
                key={category.title}
                className="overflow-hidden rounded-[24px] border bg-white shadow-sm dark:bg-[var(--color-paper-raised)]"
                style={{ borderColor: "var(--color-line)" }}
              >
                <button
                  type="button"
                  onClick={() => toggle(category.title)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors"
                  style={isOpen ? { background: "linear-gradient(135deg, var(--color-accent) 0%, #ffe27a 100%)" } : { backgroundColor: "transparent" }}
                >
                  <span className="flex items-center gap-3">
                    <GlowBadge
                      size={38}
                      tone={isOpen ? "var(--color-ink)" : "var(--color-action-dark)"}
                      icon={
                        <span className="text-sm font-extrabold">{category.items.length}</span>
                      }
                    />
                    <h2 className="text-sm font-extrabold uppercase tracking-wide sm:text-base" style={{ color: "var(--color-ink)" }}>
                      {category.title}
                    </h2>
                  </span>
                  <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
                    <ChevronDown className="h-5 w-5" style={{ color: isOpen ? "var(--color-ink)" : "var(--color-ink-soft)" }} />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden border-t"
                      style={{ borderColor: "var(--color-line)" }}
                    >
                      <div className="grid gap-3 p-4 sm:grid-cols-2">
                        {category.items.map((item) => (
                          <div
                            key={item.name}
                            className="flex flex-col justify-between rounded-2xl border p-4 transition-shadow hover:shadow-md"
                            style={{ borderColor: "var(--color-line)", backgroundColor: "var(--color-paper)" }}
                          >
                            <div>
                              <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                                {item.name}
                              </p>
                              {item.note && (
                                <p className="mt-0.5 text-xs" style={{ color: "var(--color-ink-soft)" }}>
                                  {item.note}
                                </p>
                              )}
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className="text-base font-extrabold" style={{ color: "var(--color-action-dark)" }}>
                                {item.price}
                              </span>
                              {FLAT_PRICE.test(item.price) ? (
                                <button
                                  type="button"
                                  onClick={() => openPaymentModal({ plan: { name: item.name, price: item.price }, service: item.name })}
                                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-[1.05]"
                                  style={{ backgroundColor: "var(--color-ink-fixed)" }}
                                >
                                  <CreditCard className="h-3.5 w-3.5" />
                                  Pay
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openQuoteModal({ plan: { name: item.name, price: item.price }, service: item.name })}
                                  className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white"
                                  style={{ borderColor: "var(--color-line)", color: "var(--color-ink)", backgroundColor: "var(--color-paper-raised)" }}
                                >
                                  Quote
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div
          className="mt-14 grid grid-cols-2 gap-6 rounded-2xl p-8 sm:grid-cols-4"
          style={{ backgroundColor: "var(--color-accent)" }}
        >
          {TRUST_POINTS.map((point) => (
            <div key={point.label} className="flex flex-col items-center gap-2 text-center">
              <GlowBadge size={44} icon={<point.icon className="h-5 w-5" />} />
              <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>
                {point.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm" style={{ color: "var(--color-ink-soft)" }}>
          <a href={CONTACT_LINKS.tel} className="font-semibold" style={{ color: "var(--color-ink)" }}>
            {BUSINESS_PHONE.display}
          </a>
          <span>{SITE_DOMAIN}</span>
          <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold" style={{ color: "var(--color-ink)" }}>
            {CONTACT_EMAIL}
          </a>
        </div>

        <p className="mt-10 text-center text-xs" style={{ color: "var(--color-ink-soft)" }}>
          Government fees are billed as actual where noted. Need something not listed here?{" "}
          <Link href="/contact" className="font-medium underline">
            Talk to our team
          </Link>
          .
        </p>
      </div>

      <QuoteModal />
      <PaymentModal />
    </div>
  );
}
