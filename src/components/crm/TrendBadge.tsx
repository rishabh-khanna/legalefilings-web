import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

// A small "+12% vs last week"-style pill. `changePct` is a plain number the
// caller computes from real data (e.g. this-week vs last-week lead count)
// — this component never invents a trend, only renders one.
export function TrendBadge({ changePct }: { changePct: number }) {
  const rounded = Math.round(changePct);
  const flat = rounded === 0;
  const positive = rounded > 0;
  const Icon = flat ? Minus : positive ? ArrowUpRight : ArrowDownRight;
  const { bg, text } = flat
    ? { bg: "var(--color-paper)", text: "var(--color-ink-soft)" }
    : positive
      ? { bg: "var(--color-success-tint)", text: "var(--color-success)" }
      : { bg: "var(--color-danger-tint)", text: "var(--color-danger)" };

  return (
    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: bg, color: text }}>
      <Icon className="h-3 w-3" />
      {flat ? "0%" : `${Math.abs(rounded)}%`}
    </span>
  );
}
