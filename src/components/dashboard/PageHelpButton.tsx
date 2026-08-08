"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, Users, X } from "lucide-react";
import { getManualEntry } from "@/content/dashboard-manual";

// The "?" next to a dashboard page's title — click to see what the page
// is for, sourced from the same manual entry the Help Assistant answers
// questions from (src/content/dashboard-manual.ts), so the two never
// disagree with each other.
//
// Looks up its own entry from the current route (instead of taking it as
// a prop) so that DashboardPageHero — used from server-rendered pages
// that pass real icon *components* (not JSX) down to sibling HeroKpi
// cards — never itself needs "use client". Only this small leaf does;
// the pathname lookup lives entirely inside this client boundary.
//
// Renders as a centered, backdropped modal (same fixed inset-0 + px-4
// pattern as the payment/record-payment modals elsewhere in the app)
// rather than a popover anchored to the button's own position. An
// anchored popover with a fixed 320–384px width would overflow off the
// right edge on a narrow phone — the button's horizontal position
// depends on how long the page title is, so there's no fixed offset
// that's safe on every page at every viewport width. A centered modal
// has no such problem at any screen size.
export function PageHelpButton() {
  const pathname = usePathname();
  const entry = getManualEntry(pathname);
  const [open, setOpen] = useState(false);

  if (!entry) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`What is the ${entry.title} page for?`}
        aria-expanded={open}
        className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-accent)]/40"
        style={{ color: "var(--color-action-dark)" }}
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(15,23,42,0.4)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border bg-white p-4 text-left shadow-2xl dark:bg-[var(--color-paper-raised)] sm:max-w-md"
            style={{ borderColor: "var(--color-line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-action-dark)" }}>
                {entry.title}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-muted-tint)]"
                style={{ color: "var(--color-ink-soft)" }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--color-ink)" }}>
              {entry.details}
            </p>
            <div className="mt-3 flex items-start gap-2 rounded-lg p-2.5" style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-muted-dark)" }} />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--color-muted-dark)" }}>
                  Who sees this / what data
                </p>
                <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--color-muted-dark)" }}>
                  {entry.access}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border px-4 py-1.5 text-sm font-semibold"
                style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
