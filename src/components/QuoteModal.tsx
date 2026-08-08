"use client";

import { useEffect, useState } from "react";
import { ConsultationForm, type SelectedPlan } from "@/components/ConsultationForm";
import { QUOTE_MODAL_EVENT, type QuoteModalDetail } from "@/lib/quote-modal";

export function QuoteModal({ serviceTitle }: { serviceTitle?: string }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<SelectedPlan | undefined>(undefined);
  // Overrides the static serviceTitle prop when the triggering PricingPlans
  // card supplied its own (see /pricing, which lists every service's plans
  // on one page and can't rely on a single page-level service name).
  const [eventService, setEventService] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<QuoteModalDetail>).detail;
      setPlan(detail?.plan);
      setEventService(detail?.service);
      setOpen(true);
    };
    window.addEventListener(QUOTE_MODAL_EVENT, handler);
    return () => window.removeEventListener(QUOTE_MODAL_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8 sm:items-center"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-xl bg-white dark:bg-[var(--color-paper-raised)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none hover:bg-black/5"
          style={{ color: "var(--color-ink-soft)" }}
        >
          &times;
        </button>
        <ConsultationForm serviceTitle={eventService ?? serviceTitle} plan={plan} />
        <div className="px-6 pb-6 pt-1 text-center">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
