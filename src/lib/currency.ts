// Business Finance is per-customer bookkeeping, not tied to India the
// way GST/TDS filing is — a customer running an export/consulting
// business may genuinely invoice in USD or EUR. The GST/TDS-specific
// reports still assume Indian tax law regardless of which currency a
// book is set to (that's inherent to what GST/TDS *are*, not something
// a currency picker can fix) — this only changes how amounts display.
export const CURRENCIES: { code: string; label: string; symbol: string; locale: string }[] = [
  { code: "INR", label: "Indian Rupee", symbol: "₹", locale: "en-IN" },
  { code: "USD", label: "US Dollar", symbol: "$", locale: "en-US" },
  { code: "EUR", label: "Euro", symbol: "€", locale: "en-US" },
  { code: "GBP", label: "British Pound", symbol: "£", locale: "en-US" },
  { code: "AED", label: "UAE Dirham", symbol: "AED ", locale: "en-US" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$", locale: "en-US" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$", locale: "en-US" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$", locale: "en-US" },
];

const DEFAULT_CURRENCY = CURRENCIES[0];

function currencyInfo(code: string | null | undefined) {
  return CURRENCIES.find((c) => c.code === code) ?? DEFAULT_CURRENCY;
}

export function formatMoney(amount: number | string, code?: string | null): string {
  const info = currencyInfo(code);
  const value = Number(amount);
  // Fixed 2 decimals — without this, toLocaleString's default varies
  // by value (₹100 → "100", ₹100.5 → "100.5", ₹100.567 → "100.567"),
  // three different precisions for the same currency depending on the
  // amount, which read as inconsistent on a report or invoice next to
  // each other. Sign goes before the symbol ("-₹100"), not between
  // symbol and digits ("₹-100") — the latter reads as a typo, not a
  // negative amount, on a P&L "Net Loss" line or a credit note.
  const formatted = Math.abs(value).toLocaleString(info.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value < 0 ? "-" : ""}${info.symbol}${formatted}`;
}
