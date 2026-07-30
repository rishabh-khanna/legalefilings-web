"use client";

import { useEffect, useState } from "react";

// A real countdown — referenced from doola.com's own offer banner (which
// counts down to a specific promo deadline). We don't have a real one-time
// deadline to point at, so rather than fake a date, this counts down to the
// next local midnight: an honest, recurring "today's rate" framing (the same
// pattern real daily-deal sites use), not a fabricated one-time expiry.
function getRemaining() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diff = Math.max(0, midnight.getTime() - now.getTime());
  const totalSeconds = Math.floor(diff / 1000);
  // No "days" unit — this resets nightly, so it would always read 00 and
  // look broken rather than like a real countdown.
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

function Digit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="flex h-7 w-7 items-center justify-center rounded text-xs font-bold sm:h-8 sm:w-8"
        style={{ backgroundColor: "#ffffff", color: "var(--color-ink-fixed)" }}
      >
        {String(value).padStart(2, "0")}
      </span>
      <span className="text-[9px] font-medium uppercase tracking-wide text-white/60">{label}</span>
    </div>
  );
}

export function CountdownTimer() {
  // Server-rendered markup can't know the visitor's clock, so the server
  // pass and the very first client pass both render null; a tick then
  // swaps in the real value post-hydration. The first tick is scheduled via
  // setTimeout (a callback) rather than calling setState directly in the
  // effect body, which is the pattern this codebase uses elsewhere to avoid
  // the cascading-render lint rule.
  const [t, setT] = useState<ReturnType<typeof getRemaining> | null>(null);

  useEffect(() => {
    const tick = () => setT(getRemaining());
    const kickoff = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, []);

  if (!t) return null;

  return (
    <div className="hidden items-center gap-1.5 sm:flex" aria-live="off">
      <Digit value={t.hours} label="Hours" />
      <Digit value={t.minutes} label="Min" />
      <Digit value={t.seconds} label="Sec" />
    </div>
  );
}
