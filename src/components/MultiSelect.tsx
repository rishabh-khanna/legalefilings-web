"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type MultiSelectOption = { value: string; label: string };

// Drop-in replacement for a filter `<select>` that needs to allow more than
// one value at once — a native `<select multiple>` requires Ctrl/Cmd-click
// to pick more than one option and shows no visible checkmarks, which is
// unusable for anyone who doesn't already know that trick. This is a
// checkbox list in a popover instead, styled to sit exactly where the
// `<select>` it replaces used to (same border/height/font as every other
// filter control in the app).
//
// `selected` empty means "no filter applied" (same meaning "All statuses"
// had as a single-select) — not "show nothing". The caller's filter
// predicate should treat an empty Set the same way it used to treat the
// value "all".
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  searchable,
  className,
}: {
  options: MultiSelectOption[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  placeholder: string;
  // Worth turning on once the list runs past what fits without scrolling
  // (a staff roster, every recipient a failed email has gone to) — a
  // filter box that's all scrolling and no search stops being usable
  // past a couple dozen options.
  searchable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  // One close path (instead of clearing `query` from a `useEffect` keyed
  // on `open`) — a setState call synchronous in an effect body triggers
  // React's cascading-render warning, and every caller that closes the
  // popover (outside click, Escape, the toggle button itself) wants the
  // search cleared anyway, so there's nothing an effect adds here.
  function close() {
    setOpen(false);
    setQuery("");
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function toggle(value: string) {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  }

  const visibleOptions = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  // Mirrors what the single-select's own summary used to be: nothing
  // picked (or literally everything picked, same meaning) reads as the
  // plain placeholder; one value shows its label; more than one collapses
  // to a count rather than an ever-growing comma list that would blow out
  // the trigger button's width.
  const buttonLabel =
    selected.size === 0 || selected.size === options.length
      ? placeholder
      : selected.size === 1
        ? (options.find((o) => o.value === [...selected][0])?.label ?? placeholder)
        : `${selected.size} selected`;

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm outline-none transition-colors hover:bg-[var(--color-paper)]"
        style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
      >
        <span className="max-w-[160px] truncate">{buttonLabel}</span>
        {selected.size > 0 && selected.size < options.length && (
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            {selected.size}
          </span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "var(--color-ink-soft)" }} />
      </button>

      {open && (
        <div
          className="absolute left-0 z-30 mt-2 w-80 overflow-hidden rounded-2xl border bg-white shadow-xl dark:bg-[var(--color-paper-raised)]"
          style={{ borderColor: "var(--color-line)" }}
        >
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "var(--color-line)" }}>
            <button
              type="button"
              onClick={() => onChange(new Set())}
              disabled={selected.size === 0}
              className="text-sm font-semibold disabled:opacity-40"
              style={{ color: "var(--color-action-dark)" }}
            >
              Clear
            </button>
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
              {selected.size === 0 ? placeholder : `${selected.size} of ${options.length}`}
            </span>
            <button
              type="button"
              onClick={() => onChange(new Set(options.map((o) => o.value)))}
              disabled={selected.size === options.length}
              className="text-sm font-semibold disabled:opacity-40"
              style={{ color: "var(--color-action-dark)" }}
            >
              Select all
            </button>
          </div>

          {searchable && options.length > 8 && (
            <div className="relative border-b px-4 py-3" style={{ borderColor: "var(--color-line)" }}>
              <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-ink-soft)" }} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-lg border py-2 pl-8 pr-3 text-sm outline-none focus:border-[var(--color-action)]"
                style={{ borderColor: "var(--color-line)" }}
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-7 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4" style={{ color: "var(--color-ink-soft)" }} />
                </button>
              )}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto p-2">
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-5 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>No matches.</p>
            ) : (
              visibleOptions.map((option) => {
                const checked = selected.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggle(option.value)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-muted-tint)]"
                    style={{ color: "var(--color-ink)" }}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                      style={{
                        border: checked ? "none" : "1.5px solid var(--color-line)",
                        backgroundColor: checked ? "var(--color-action)" : "transparent",
                      }}
                    >
                      {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
