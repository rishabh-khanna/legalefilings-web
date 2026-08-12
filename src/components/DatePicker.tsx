"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseISO(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Replaces the browser's own <input type="date"> — which renders a
// different, largely unstylable calendar per browser (and a genuinely
// bad one on some) — with one popup calendar that looks the same
// everywhere and actually matches the rest of the app. Value/onChange
// stay plain ISO "YYYY-MM-DD" strings, the same contract the native
// input had, so every call site swaps in without touching its own
// state handling.
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Select date",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const selected = parseISO(value);
  const minDate = min ? parseISO(min) : null;
  const maxDate = max ? parseISO(max) : null;
  const [viewDate, setViewDate] = useState(() => selected ?? new Date());

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function measure() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPanelPos({ top: rect.bottom + 6, left: rect.left });
  }

  useEffect(() => {
    if (!open) return;
    function onResize() {
      measure();
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  // Monday-first grid: JS getDay() is Sunday-first (0-6), so shift it
  // back one and wrap Sunday (0) to the end of the week.
  const leadingBlank = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlank }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  const today = new Date();

  function isDisabled(d: Date) {
    if (minDate && d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && d > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (!open) {
            measure();
            setViewDate(selected ?? new Date());
          }
          setOpen((v) => !v);
        }}
        className={className ?? "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm outline-none transition-colors focus:border-[var(--color-action)]"}
        style={{ borderColor: "var(--color-line)", color: selected ? "var(--color-ink)" : "var(--color-ink-soft)" }}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-ink-soft)" }} />
        {selected ? selected.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : placeholder}
      </button>

      {open &&
        panelPos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            className="fixed z-[200] w-64 rounded-2xl border bg-white p-3 shadow-2xl dark:bg-[var(--color-paper-raised)]"
            style={{ top: panelPos.top, left: panelPos.left, borderColor: "var(--color-line)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month - 1, 1))}
                aria-label="Previous month"
                className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-muted-tint)]"
              >
                <ChevronLeft className="h-4 w-4" style={{ color: "var(--color-ink-soft)" }} />
              </button>
              <p className="text-sm font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
                {viewDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </p>
              <button
                type="button"
                onClick={() => setViewDate(new Date(year, month + 1, 1))}
                aria-label="Next month"
                className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-muted-tint)]"
              >
                <ChevronRight className="h-4 w-4" style={{ color: "var(--color-ink-soft)" }} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-y-1 text-center">
              {WEEKDAY_LABELS.map((w) => (
                <span key={w} className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--color-ink-soft)" }}>
                  {w}
                </span>
              ))}
              {cells.map((d, i) => {
                if (!d) return <span key={`blank-${i}`} />;
                const disabled = isDisabled(d);
                const isSelected = selected && sameDay(d, selected);
                const isToday = sameDay(d, today);
                return (
                  <button
                    key={d.toISOString()}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(toISO(d));
                      setOpen(false);
                    }}
                    className="mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                    style={
                      isSelected
                        ? { backgroundColor: "var(--color-action)", color: "var(--color-ink)", fontWeight: 700 }
                        : isToday
                          ? { border: "1.5px solid var(--color-action)", color: "var(--color-ink)" }
                          : { color: "var(--color-ink)" }
                    }
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = "var(--color-accent-tint)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--color-line)" }}>
              <button
                type="button"
                onClick={() => {
                  onChange(toISO(today));
                  setOpen(false);
                }}
                disabled={isDisabled(today)}
                className="text-xs font-semibold disabled:opacity-40"
                style={{ color: "var(--color-action-dark)" }}
              >
                Today
              </button>
              {value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="text-xs font-semibold"
                  style={{ color: "var(--color-ink-soft)" }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
