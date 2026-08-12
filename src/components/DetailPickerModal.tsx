"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";

export type DetailPickerOption = {
  value: string;
  label: string;
  // Extra context shown under the label, both in the trigger's closed
  // state (if selected) and in every row of the open picker — e.g. a
  // live balance ("7.0 days available") next to a leave type, so the
  // choice is informed without a separate lookup. Generic on purpose:
  // any "pick one of these, and here's what picking it means" flow can
  // reuse this instead of a bare native <select>.
  detail?: ReactNode;
};

export function DetailPickerModal({
  options,
  value,
  onChange,
  placeholder = "Select…",
  emptyOptionLabel,
}: {
  options: DetailPickerOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  // Rendered as a trailing row with value "" — e.g. "Unpaid Leave" as a
  // fallback choice outside the main option list.
  emptyOptionLabel?: DetailPickerOption;
}) {
  const [open, setOpen] = useState(false);
  const allOptions = emptyOptionLabel ? [...options, emptyOptionLabel] : options;
  const selected = allOptions.find((o) => o.value === value);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm outline-none focus:border-[var(--color-action)] dark:bg-[var(--color-paper-raised)]"
        style={{ borderColor: "var(--color-line)" }}
      >
        <span className="min-w-0 truncate">
          <span style={{ color: selected ? "var(--color-ink)" : "var(--color-ink-soft)" }}>{selected?.label ?? placeholder}</span>
          {selected?.detail && <span className="ml-1.5 text-xs" style={{ color: "var(--color-ink-soft)" }}>· {selected.detail}</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--color-ink-soft)" }} />
      </button>

      {open && (
        <div
          // z-[100] — higher than any modal this picker might be opened
          // from (the highest elsewhere in the app is z-[95], on
          // AddTransactionModal); this picker needs to render on top
          // regardless of which parent modal it's nested inside. Stays
          // below Toaster's z-[110] deliberately — a toast must remain
          // visible even while this picker is open.
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
          // Stopped here, not left to bubble — this picker can itself be
          // opened from inside another modal (e.g. the Leave apply
          // dialog), whose own backdrop also closes on click. Without
          // stopping propagation, clicking this backdrop to dismiss just
          // the picker would also close the parent dialog underneath it.
          onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <div
            className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-2xl border bg-white p-2 shadow-xl dark:bg-[var(--color-paper-raised)]"
            style={{ borderColor: "var(--color-line)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {allOptions.map((o) => {
              const isSelected = o.value === value;
              return (
                <button
                  key={o.value || "__empty__"}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-muted-tint)]"
                  style={isSelected ? { backgroundColor: "var(--color-accent-tint)" } : undefined}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>{o.label}</p>
                    {o.detail && (
                      <p className="mt-0.5 text-xs" style={{ color: "var(--color-ink-soft)" }}>
                        {o.detail}
                      </p>
                    )}
                  </div>
                  {isSelected && <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--color-action-dark)" }} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

// A small live-math summary card — "you have X, you're asking for Y,
// you'll have Z left." Generic enough to reuse anywhere a form commits
// against a finite balance (leave days now; anything similar later).
export function BalanceSummary({
  available,
  requested,
  unit = "days",
  overflowNote,
}: {
  available: number;
  requested: number;
  unit?: string;
  overflowNote?: ReactNode;
}) {
  const remaining = available - requested;
  const overflow = remaining < 0;
  return (
    <div className="rounded-xl border px-3 py-2.5 text-xs" style={{ borderColor: "var(--color-line)", backgroundColor: "var(--color-paper)" }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span style={{ color: "var(--color-ink-soft)" }}>
          Available: <span className="font-semibold" style={{ color: "var(--color-ink)" }}>{available.toFixed(1)} {unit}</span>
        </span>
        <span style={{ color: "var(--color-ink-soft)" }}>
          Requesting: <span className="font-semibold" style={{ color: "var(--color-ink)" }}>{requested} {unit}</span>
        </span>
        <span style={{ color: "var(--color-ink-soft)" }}>
          Remaining after: <span className="font-semibold" style={{ color: overflow ? "var(--color-danger)" : "var(--color-ink)" }}>{Math.max(0, remaining).toFixed(1)} {unit}</span>
        </span>
      </div>
      {overflow && overflowNote && (
        <p className="mt-1.5" style={{ color: "var(--color-danger)" }}>{overflowNote}</p>
      )}
    </div>
  );
}
