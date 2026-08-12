"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Same popup treatment as DatePicker, one level up — a 12-month grid
// with year navigation instead of a day grid, for the month-granularity
// pickers (payroll month, report month) that don't need a day at all.
// Value/onChange stay plain "YYYY-MM" strings, same as the native
// <input type="month"> it replaces.
export function MonthPicker({
  value,
  onChange,
  min,
  max,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const [year, month] = value ? value.split("-").map(Number) : [new Date().getFullYear(), new Date().getMonth() + 1];
  const [viewYear, setViewYear] = useState(year);

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

  const [minY, minM] = min ? min.split("-").map(Number) : [null, null];
  const [maxY, maxM] = max ? max.split("-").map(Number) : [null, null];
  function isDisabled(y: number, m: number) {
    if (minY != null && (y < minY || (y === minY && m < (minM ?? 1)))) return true;
    if (maxY != null && (y > maxY || (y === maxY && m > (maxM ?? 12)))) return true;
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
            setViewYear(year);
          }
          setOpen((v) => !v);
        }}
        className={className ?? "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm outline-none transition-colors focus:border-[var(--color-action)]"}
        style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--color-ink-soft)" }} />
        {value ? new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "Select month"}
      </button>

      {open &&
        panelPos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            className="fixed z-[200] w-60 rounded-2xl border bg-white p-3 shadow-2xl dark:bg-[var(--color-paper-raised)]"
            style={{ top: panelPos.top, left: panelPos.left, borderColor: "var(--color-line)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewYear((y) => y - 1)}
                aria-label="Previous year"
                className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-muted-tint)]"
              >
                <ChevronLeft className="h-4 w-4" style={{ color: "var(--color-ink-soft)" }} />
              </button>
              <p className="text-sm font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
                {viewYear}
              </p>
              <button
                type="button"
                onClick={() => setViewYear((y) => y + 1)}
                aria-label="Next year"
                className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-muted-tint)]"
              >
                <ChevronRight className="h-4 w-4" style={{ color: "var(--color-ink-soft)" }} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {MONTH_LABELS.map((label, i) => {
                const m = i + 1;
                const disabled = isDisabled(viewYear, m);
                const isSelected = value === `${viewYear}-${String(m).padStart(2, "0")}`;
                const isCurrent = viewYear === new Date().getFullYear() && m === new Date().getMonth() + 1;
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(`${viewYear}-${String(m).padStart(2, "0")}`);
                      setOpen(false);
                    }}
                    className="rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                    style={
                      isSelected
                        ? { backgroundColor: "var(--color-action)", color: "var(--color-ink)" }
                        : isCurrent
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
                    {label}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
