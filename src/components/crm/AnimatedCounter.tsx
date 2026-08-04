"use client";

import { useEffect, useRef, useState } from "react";

// Counts up from 0 to `value` once mounted/updated — a generic version of
// the one built for the homepage stats bento, reused across every CRM KPI
// card so numbers feel alive instead of static.
export function AnimatedCounter({ value, duration = 900, prefix = "", suffix = "" }: { value: number; duration?: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
      else prevValue.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <>
      {prefix}
      {display.toLocaleString("en-IN")}
      {suffix}
    </>
  );
}
