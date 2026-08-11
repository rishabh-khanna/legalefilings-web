"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Tooltip } from "@/components/Tooltip";

export type ActionItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick?: () => void;
  href?: string;
  color?: string;
  disabled?: boolean;
};

// A dense action set — invoice row actions, order actions, anything a
// table row needs several of — as compact colored icon buttons with a
// tooltip standing in for the label, plus an overflow "⋯" menu for
// whatever doesn't need to be visible on every single row. Replaces the
// wall-of-underlined-text-links pattern (PDF/Print, Edit, Send, Email,
// Record Payment, WhatsApp, Copy Link, Files, History, all spelled out
// and wrapping across 2-3 lines per row) with something that reads as
// one row height regardless of how many actions a given row happens to
// have, the same "primary actions visible, the rest one click away"
// split every dense table UI (Gmail, Linear, Notion, Stripe) already
// uses — a full-page hero action bar is a different context (see
// Business Finance, which deliberately went the other way: every action
// visible, no menu, because there's only ever one row of it on screen).
export function ActionsMenu({ primary, overflow }: { primary: ActionItem[]; overflow?: ActionItem[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function iconButton(item: ActionItem, key: string): ReactNode {
    const Icon = item.icon;
    const className = "flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-muted-tint)] disabled:pointer-events-none disabled:opacity-40";
    const style = { color: item.color ?? "var(--color-ink-soft)" };
    const inner = <Icon className="h-3.5 w-3.5" />;
    return (
      <Tooltip key={key} content={item.label}>
        {item.href ? (
          <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label={item.label} className={className} style={style}>
            {inner}
          </a>
        ) : (
          <button type="button" onClick={(e) => { e.stopPropagation(); item.onClick?.(); }} disabled={item.disabled} aria-label={item.label} className={className} style={style}>
            {inner}
          </button>
        )}
      </Tooltip>
    );
  }

  return (
    <div ref={rootRef} className="relative flex items-center gap-1">
      {primary.map((item) => iconButton(item, item.key))}

      {overflow && overflow.length > 0 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            aria-label="More actions"
            aria-expanded={open}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-muted-tint)]"
            style={{ color: "var(--color-ink-soft)" }}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {open && (
            <div
              className="absolute right-0 top-full z-30 mt-1.5 w-44 overflow-hidden rounded-xl border bg-white py-1 shadow-xl dark:bg-[var(--color-paper-raised)]"
              style={{ borderColor: "var(--color-line)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {overflow.map((item) => {
                const Icon = item.icon;
                const content = (
                  <>
                    <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-ink-soft)]" />
                    {item.label}
                  </>
                );
                const className = "flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-[var(--color-muted-tint)] disabled:pointer-events-none disabled:opacity-40";
                return item.href ? (
                  <a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className={className} style={{ color: "var(--color-ink)" }}>
                    {content}
                  </a>
                ) : (
                  <button
                    key={item.key}
                    type="button"
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(false);
                      item.onClick?.();
                    }}
                    className={className}
                    style={{ color: "var(--color-ink)" }}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
