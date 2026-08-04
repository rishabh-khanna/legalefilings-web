"use client";

import { useEffect, useState } from "react";
import { EntityFinderCard } from "@/components/EntityFinderCard";
import { ENTITY_FINDER_MODAL_EVENT } from "@/lib/entity-finder-modal";

const SESSION_KEY = "entity-finder-auto-shown";
const IDLE_MS = 15_000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "scroll", "touchstart", "click"] as const;

// Pops up after the visitor's gone idle for 15s (not on a fixed delay
// regardless of what they're doing) — once per browser session, not on
// every page view. The idle timer resets on any real activity, and is
// torn down entirely when this component unmounts (i.e. the moment the
// visitor navigates away from the page it's mounted on) rather than
// firing somewhere they've already left.
export function EntityFinderModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(ENTITY_FINDER_MODAL_EVENT, handler);

    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const alreadyShown = Boolean(sessionStorage.getItem(SESSION_KEY));

    function resetIdleTimer() {
      if (alreadyShown) return;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        setOpen(true);
        sessionStorage.setItem(SESSION_KEY, "1");
      }, IDLE_MS);
    }

    if (!alreadyShown) {
      resetIdleTimer();
      ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetIdleTimer, { passive: true }));
    }

    return () => {
      window.removeEventListener(ENTITY_FINDER_MODAL_EVENT, handler);
      if (idleTimer) clearTimeout(idleTimer);
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetIdleTimer));
    };
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-8 sm:items-center"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.25)", backdropFilter: "blur(2px)" }}
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Find your right business structure"
        className="relative w-full max-w-2xl rounded-[28px] bg-white p-1 shadow-2xl dark:bg-[var(--color-paper-raised)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md transition-transform hover:scale-110 dark:bg-[var(--color-paper-raised)]"
          style={{ color: "var(--color-ink-soft)", border: "1px solid var(--color-line)" }}
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
          </svg>
        </button>

        <div className="px-4 py-8 sm:px-8">
          <EntityFinderCard compact />
        </div>
      </div>
    </div>
  );
}
