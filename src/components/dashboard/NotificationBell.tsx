"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  href: string;
  at: string | null;
  tone: "act" | "watch";
};

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// Everything currently waiting on this person, in one place. Items are
// derived live from the database (see /api/notifications), so actioning
// one makes it disappear on the next load rather than leaving a read
// receipt to manage.
export function NotificationBell() {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonWrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) setItems((await res.json()).items ?? []);
    } catch {
      // A failed poll shouldn't surface an error in the chrome — the
      // bell just keeps showing whatever it last knew.
    }
  }

  // Refetch on navigation: the most common way an item stops being
  // relevant is the viewer going and dealing with it.
  useEffect(() => {
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, [pathname]);

  // Close on outside click, matching the nav flyout's behaviour. The
  // panel is portaled out to <body> (see the render below), so "outside"
  // now means outside BOTH the bell button and the portaled panel —
  // checking just one would close it the instant a click landed inside
  // the other.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonWrapRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function measure() {
    const rect = buttonWrapRef.current?.getBoundingClientRect();
    if (rect) setPanelPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
  }

  function toggleOpen() {
    if (!open) measure();
    setOpen((v) => !v);
  }

  // Fixed positioning is computed once on open, from the button's rect at
  // that instant — a resize while the panel is open (or a mobile
  // orientation change) would otherwise leave it pinned to stale
  // coordinates instead of tracking the button underneath it.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  // Only things actually blocking someone drive the badge — an
  // unclaimed lead or a logged email failure is worth showing in the
  // list but shouldn't make the bell look urgent.
  const actionable = (items ?? []).filter((i) => i.tone === "act").length;

  return (
    <div className="relative" ref={buttonWrapRef}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={actionable > 0 ? `Notifications — ${actionable} need attention` : "Notifications"}
        aria-expanded={open}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border bg-white/70 backdrop-blur transition-colors hover:bg-white"
        style={{ borderColor: "var(--color-line)" }}
      >
        <Bell className="h-5 w-5" style={{ color: "var(--color-ink)" }} />
        {actionable > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ backgroundColor: "var(--color-danger)" }}
          >
            {actionable > 9 ? "9+" : actionable}
          </span>
        )}
      </button>

      {/* Portaled to <body> with position: fixed rather than CSS-absolute
          inside this component's own DOM position — the bell sits inside
          the dashboard's welcome band, which has overflow-hidden (to
          contain its own decorative glow orb), and that clipped this
          panel the instant it grew taller than the band itself. Same
          fix, same reasoning, as Tooltip.tsx. */}
      {open && panelPos &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[200] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-white shadow-xl dark:bg-[var(--color-paper-raised)]"
            style={{ top: panelPos.top, right: panelPos.right, borderColor: "var(--color-line)" }}
          >
          <div className="border-b px-4 py-3" style={{ borderColor: "var(--color-line)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--color-ink)" }}>Needs your attention</p>
            <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
              {items === null
                ? "Checking…"
                : actionable > 0
                  ? `${actionable} item${actionable === 1 ? "" : "s"} waiting on you`
                  : "Nothing waiting on you"}
            </p>
          </div>

          <div className="max-h-[24rem] overflow-y-auto">
            {items !== null && items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
                You&apos;re all caught up.
              </p>
            )}
            {(items ?? []).map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex gap-3 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-[var(--color-paper)]"
                style={{ borderColor: "var(--color-line)" }}
              >
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.tone === "act" ? "var(--color-danger)" : "var(--color-line)" }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold" style={{ color: "var(--color-ink)" }}>{item.title}</span>
                  <span className="block truncate text-xs" style={{ color: "var(--color-ink-soft)" }}>{item.detail}</span>
                </span>
                <span className="shrink-0 text-[11px]" style={{ color: "var(--color-ink-soft)" }}>{relativeTime(item.at)}</span>
              </Link>
            ))}
          </div>
          </div>,
          document.body
        )}
    </div>
  );
}
