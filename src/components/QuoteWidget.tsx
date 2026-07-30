"use client";

import { useEffect, useState } from "react";
import { openQuoteModal } from "@/lib/quote-modal";
import { LogoMark } from "@/components/LogoMark";

// A real floating widget (not an inline card sitting in the page content) —
// bottom-LEFT specifically, since bottom-right is already a two-button stack
// (WhatsApp + the AI assistant, see FloatingContact.tsx / AiAssistant.tsx);
// putting a third button there would either collide with those or need to
// stack even higher. Clicking it opens the same QuoteModal every "Register
// Now" / "Get Free Consultation" button on the page already opens — this
// doesn't need its own modal, just another way to trigger the existing one.
//
// serviceTitle is optional so the same widget can sit on the homepage (no
// single service in context) as well as on a service page.
export function QuoteWidget({ serviceTitle }: { serviceTitle?: string }) {
  // Fixed-position, so it sits at the same screen spot regardless of scroll —
  // on a hero tall enough to fill the viewport, that spot coincided with the
  // real Trustpilot rating in the hero's bottom-left corner and covered it.
  // Hiding the widget until the visitor has scrolled a little keeps it off
  // the first paint (where it can collide with hero content) and brings it
  // in once they're past it — it's always reachable within a scroll or two.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 160);
    // Deferred (not called synchronously in the effect body) — same pattern
    // used elsewhere in this codebase (CountdownTimer, AiAssistant) to avoid
    // the cascading-render lint rule.
    const kickoff = setTimeout(onScroll, 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(kickoff);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => openQuoteModal()}
      className="group fixed bottom-6 left-6 z-30 hidden items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4 shadow-[0_2px_8px_rgba(0,0,0,0.15),0_12px_28px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.18),0_16px_36px_rgba(0,0,0,0.22)] sm:flex"
      style={{ backgroundColor: "var(--color-ink-fixed)" }}
      aria-label={serviceTitle ? `Get a free quote for ${serviceTitle}` : "Get a free quote"}
    >
      <span className="relative shrink-0">
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ping rounded-full opacity-40"
          style={{ backgroundColor: "var(--color-accent)" }}
        />
        <LogoMark className="relative h-10 w-10 ring-2 ring-white/25" />
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2"
          style={{ backgroundColor: "#22c55e", ["--tw-ring-color" as string]: "var(--color-ink-fixed)" }}
        />
      </span>
      <span className="text-left leading-tight">
        <span className="block text-sm font-semibold text-white">Get a Free Quote</span>
        <span className="block text-xs text-white/60">Replies in minutes</span>
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="h-4 w-4 shrink-0 text-white/50 transition-transform group-hover:translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
