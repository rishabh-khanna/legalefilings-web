"use client";

import { useMemo, useState } from "react";

// Shared client-side date-range filter — every dashboard table with a
// date column gets the same "From" / "To" pair instead of each page
// inventing its own. Bounds are inclusive, compared by calendar day
// (not exact timestamp), so picking the same day for From and To
// includes everything recorded that day regardless of time-of-day.
export function useDateRangeFilter<T>(items: T[], getDate: (item: T) => string | Date | null | undefined) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    if (!from && !to) return items;
    const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : null;
    const toMs = to ? new Date(`${to}T23:59:59.999`).getTime() : null;
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
  }, [items, from, to]);

  function clear() {
    setFrom("");
    setTo("");
  }

  return { from, setFrom, to, setTo, filtered, clear, active: Boolean(from || to) };
}
