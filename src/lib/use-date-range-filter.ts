"use client";

import { useMemo, useState } from "react";

// Shared client-side date-range filter — every dashboard table with a
// date column gets the same "From" / "To" pair instead of each page
// inventing its own. Bounds are inclusive, compared by calendar day
// (not exact timestamp), so picking the same day for From and To
// includes everything recorded that day regardless of time-of-day.
//
// from/to are the draft values the date pickers are bound to; they
// don't filter anything by themselves. Filtering only happens against
// appliedFrom/appliedTo, which only change when search() runs — picking
// a date and having the table re-filter on every click read as
// unpredictable on a large table, and a picked-but-not-yet-applied date
// with no visible effect read as broken. search() is the one place that
// moves draft into applied.
export function useDateRangeFilter<T>(items: T[], getDate: (item: T) => string | Date | null | undefined) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");

  const filtered = useMemo(() => {
    if (!appliedFrom && !appliedTo) return items;
    const fromMs = appliedFrom ? new Date(`${appliedFrom}T00:00:00`).getTime() : null;
    const toMs = appliedTo ? new Date(`${appliedTo}T23:59:59.999`).getTime() : null;
    return items.filter((item) => {
      const raw = getDate(item);
      if (!raw) return false;
      const ms = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
      if (Number.isNaN(ms)) return false;
      if (fromMs !== null && ms < fromMs) return false;
      if (toMs !== null && ms > toMs) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, appliedFrom, appliedTo]);

  function search() {
    setAppliedFrom(from);
    setAppliedTo(to);
  }

  function clear() {
    setFrom("");
    setTo("");
    setAppliedFrom("");
    setAppliedTo("");
  }

  return {
    from,
    setFrom,
    to,
    setTo,
    filtered,
    clear,
    search,
    // Draft differs from what's actually applied — the Search button
    // uses this to show there's a pending change to apply.
    dirty: from !== appliedFrom || to !== appliedTo,
    active: Boolean(appliedFrom || appliedTo),
  };
}
