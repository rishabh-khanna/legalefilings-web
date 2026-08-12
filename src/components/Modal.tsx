"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

// The one popup shell every "Edit" form and confirmation dialog in the
// app should render through — Esc to close, a backdrop click to close,
// body scroll locked while open, portaled to <body> so it's never at the
// mercy of an ancestor's overflow-hidden (see NotificationBell/
// ActionsMenu for the exact clipping bug this sidesteps). Replaces the
// older pattern of an "Edit" button revealing a form inline in the page
// flow — which pushed everything below it down the page and read as a
// second page state rather than a focused, transient action.
export function Modal({
  title,
  onClose,
  children,
  maxWidth = "max-w-lg",
}: {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8 backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidth} rounded-2xl border bg-white p-6 shadow-2xl dark:bg-[var(--color-paper-raised)]`}
        style={{ borderColor: "var(--color-line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none transition-colors hover:bg-[var(--color-muted-tint)]"
          style={{ color: "var(--color-ink-soft)" }}
        >
          &times;
        </button>
        {title && (
          <h2 className="mb-4 pr-8 text-lg font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}
