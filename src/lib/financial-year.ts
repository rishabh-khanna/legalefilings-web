// Shared Indian financial-year math (April–March) — used anywhere a
// user needs to pick "which FY" rather than just "this FY": the
// Business Finance setup wizard (picking the FY to start bookkeeping
// in) and the Reports page's Financial Year date-range preset (picking
// which FY's data to pull, not always the current one).
export function currentFinancialYearStart(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

export function formatFinancialYear(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

// A couple of years back (for catching up on unrecorded history)
// through one year ahead (for setting up/reporting early).
export function financialYearOptions(): { startYear: number; label: string }[] {
  const currentStart = currentFinancialYearStart();
  const options: { startYear: number; label: string }[] = [];
  for (let y = currentStart - 2; y <= currentStart + 1; y++) {
    options.push({ startYear: y, label: formatFinancialYear(y) });
  }
  return options;
}

export function defaultFinancialYear(): string {
  return formatFinancialYear(currentFinancialYearStart());
}

// Inclusive [from, to] ISO date strings for the FY starting April 1 of
// startYear through March 31 of startYear + 1 — capped at today if the
// FY is still in progress, so a report for the current (incomplete) FY
// doesn't return future-dated rows.
export function financialYearRange(startYear: number): { from: string; to: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const from = new Date(startYear, 3, 1);
  const naturalEnd = new Date(startYear + 1, 2, 31);
  const today = new Date();
  const to = naturalEnd < today ? naturalEnd : today;
  return { from: fmt(from), to: fmt(to) };
}
