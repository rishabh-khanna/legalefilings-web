import type { getSupabaseAdmin } from "@/lib/supabase-admin";

type Supabase = ReturnType<typeof getSupabaseAdmin>;

// One definition of "a day someone was expected to work", shared by leave
// deduction, leave crediting, and payroll loss-of-pay.
//
// These used to disagree: leave counted raw calendar days while LOP
// counted weekdays only, so Friday-to-Monday leave cost an employee four
// days of balance for two days of absence — they were silently charged
// for the weekend. Neither side consulted the Holiday Calendar at all,
// so anyone not clocking in on Diwali was marked loss-of-pay and docked.
//
// Holidays are passed in rather than fetched here so this stays pure and
// testable, and so a caller working across a whole month fetches once
// instead of per-day.

export function isWeekend(date: Date): boolean {
  const dow = date.getUTCDay();
  return dow === 0 || dow === 6;
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** A working day = not a weekend and not a company holiday. */
export function isWorkingDay(date: Date, holidays: Set<string>): boolean {
  return !isWeekend(date) && !holidays.has(toDateKey(date));
}

/** Working days in an inclusive date range, e.g. "2026-08-07".."2026-08-10". */
export function countWorkingDays(startDate: string, endDate: string, holidays: Set<string>): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (end < start) return 0;
  let count = 0;
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (isWorkingDay(d, holidays)) count++;
  }
  return count;
}

/** Working days in a calendar month (1-indexed month). */
export function workingDaysInMonth(month: number, year: number, holidays: Set<string>): number {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return countWorkingDays(
    `${year}-${String(month).padStart(2, "0")}-01`,
    `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    holidays
  );
}

/**
 * Company holiday dates for one organization overlapping [from, to].
 * Returns a Set of "YYYY-MM-DD" keys ready for the helpers above.
 */
export async function fetchHolidayDates(
  supabase: Supabase,
  organizationId: string,
  from: string,
  to: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from("holidays")
    .select("date")
    .eq("organization_id", organizationId)
    .gte("date", from)
    .lte("date", to);
  return new Set((data ?? []).map((h) => String(h.date).slice(0, 10)));
}
