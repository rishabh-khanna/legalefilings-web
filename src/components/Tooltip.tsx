"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// A hover tooltip rendered via a portal to <body> and positioned with
// `position: fixed` from the trigger's real viewport coordinates — not
// CSS-absolute inside the trigger's own DOM position. Several table
// cells this pairs with (TruncatedText below) sit inside a
// horizontally-scrolling container (overflow-x: auto on DataTable's
// wrapper), and setting overflow-x forces overflow-y to stop being
// `visible` too, per the CSS spec — a plain absolutely-positioned
// tooltip would get silently clipped by that wrapper the moment it
// tried to float above or below its row. Escaping to the body via a
// portal sidesteps that entirely.
export function Tooltip({ content, children, className }: { content: ReactNode; children: ReactNode; className?: string }) {
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null);
  const ref = useRef<HTMLSpanElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleShow() {
    timer.current = setTimeout(() => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      // Not enough room above (near the top of the viewport, e.g. the
      // table's own first row) — show below instead rather than letting
      // the tooltip run off-screen.
      const flip = rect.top < 72;
      setPos({ top: flip ? rect.bottom + 8 : rect.top - 8, left: rect.left + rect.width / 2, flip });
    }, 250);
  }
  function hide() {
    if (timer.current) clearTimeout(timer.current);
    setPos(null);
  }

  return (
    <span ref={ref} className={className ?? "inline-block"} onMouseEnter={scheduleShow} onMouseLeave={hide}>
      {children}
      {pos &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            role="tooltip"
            className={`pointer-events-none fixed z-[200] w-max max-w-xs -translate-x-1/2 rounded-lg px-3 py-2 text-xs font-medium leading-relaxed shadow-lg ${pos.flip ? "" : "-translate-y-full"}`}
            style={{ top: pos.top, left: pos.left, backgroundColor: "var(--color-ink)", color: "#fff" }}
          >
            {content}
          </span>,
          document.body
        )}
    </span>
  );
}
