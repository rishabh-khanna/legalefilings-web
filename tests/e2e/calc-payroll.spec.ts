import { test, expect } from "@playwright/test";
import { calculatePayroll, computeLopDays } from "../../src/lib/payroll";
import { professionalTaxFor, hasKnownPtSchedule } from "../../src/lib/professional-tax";
import { isWeekend, isWorkingDay, countWorkingDays, workingDaysInMonth } from "../../src/lib/working-days";

// Pure-function regression tests for the actual payroll math
// (src/lib/payroll.ts, professional-tax.ts, working-days.ts) — every
// expected number is worked out by hand against the documented formulas
// (PF 12% of basic capped at ₹15,000, ESI 0.75% of gross under ₹21,000,
// state-specific Professional Tax slabs, LOP = gross/daysInMonth *
// lopDays), independent of the implementation.

test.describe("calculatePayroll", () => {
  test("basic scenario within both PF and ESI ceilings, no state (fallback PT slab)", () => {
    // gross = 10,000 + 4,000 + 2,000 = 16,000
    // pf = min(10000, 15000) * 12% = 1,200
    // esi = 16,000 <= 21,000 -> round(16,000 * 0.75%) = 120
    // pt = fallback slab: gross > 15,000 -> 200
    // net = 16,000 - 1,200 - 120 - 200 = 14,480
    const calc = calculatePayroll({ basic: 10000, hra: 4000, specialAllowance: 2000, bonus: 0, incentives: 0 });
    expect(calc.grossSalary).toBe(16000);
    expect(calc.pfDeduction).toBe(1200);
    expect(calc.esiDeduction).toBe(120);
    expect(calc.professionalTax).toBe(200);
    expect(calc.tds).toBe(0);
    expect(calc.lopDeduction).toBe(0);
    expect(calc.netSalary).toBe(14480);
  });

  test("PF is capped at the ₹15,000 wage ceiling even when basic is much higher", () => {
    // basic 20,000 -> pf uses min(20000, 15000) = 15,000 * 12% = 1,800,
    // NOT 20,000 * 12% = 2,400.
    const calc = calculatePayroll({ basic: 20000, hra: 8000, specialAllowance: 0, bonus: 0, incentives: 0 });
    expect(calc.grossSalary).toBe(28000);
    expect(calc.pfDeduction).toBe(1800);
  });

  test("ESI applies at exactly the ₹21,000 ceiling (inclusive), not above it", () => {
    const atCeiling = calculatePayroll({ basic: 15000, hra: 6000, specialAllowance: 0, bonus: 0, incentives: 0 }); // gross = 21,000
    expect(atCeiling.grossSalary).toBe(21000);
    expect(atCeiling.esiDeduction).toBe(158); // round(21000 * 0.0075) = round(157.5) = 158

    const aboveCeiling = calculatePayroll({ basic: 15000, hra: 6001, specialAllowance: 0, bonus: 0, incentives: 0 }); // gross = 21,001
    expect(aboveCeiling.esiDeduction).toBe(0);
  });

  test("bonus, incentives, and overtime all count toward gross salary", () => {
    const calc = calculatePayroll({ basic: 10000, hra: 2000, specialAllowance: 0, bonus: 5000, incentives: 3000, overtime: 1500 });
    expect(calc.grossSalary).toBe(10000 + 2000 + 5000 + 3000 + 1500);
  });

  test("Loss of Pay deduction: gross ÷ payableDays × lopDays, rounded", () => {
    // gross = 20,000 + 10,000 = 30,000; 5 LOP days out of 20 payable days ->
    // 30,000 / 20 * 5 = 7,500 exactly.
    // Statutory deductions then apply to EARNED gross (post-LOP), not
    // the full structure — you don't owe PF/PT on pay you never
    // received: earnedGross = 30,000 - 7,500 = 22,500, earnedRatio =
    // 0.75, earnedBasic = 20,000 * 0.75 = 15,000.
    // pf = min(15000, 15000) * 12% = 1,800
    // esi: earnedGross 22,500 > 21,000 -> 0
    // pt: fallback slab, earnedGross 22,500 > 15,000 -> 200
    // net = 22,500 - 1,800 - 0 - 200 = 20,500
    const calc = calculatePayroll({ basic: 20000, hra: 10000, specialAllowance: 0, bonus: 0, incentives: 0, lopDays: 5, payableDays: 20 });
    expect(calc.lopDeduction).toBe(7500);
    expect(calc.pfDeduction).toBe(1800);
    expect(calc.esiDeduction).toBe(0);
    expect(calc.professionalTax).toBe(200);
    expect(calc.netSalary).toBe(20500);
  });

  test("zero LOP days produces zero LOP deduction even with payableDays set", () => {
    const calc = calculatePayroll({ basic: 20000, hra: 10000, specialAllowance: 0, bonus: 0, incentives: 0, lopDays: 0, payableDays: 22 });
    expect(calc.lopDeduction).toBe(0);
  });

  test("REGRESSION: a full month of Loss of Pay (absent every payable day) deducts the FULL salary, not a fraction of it", () => {
    // This is the exact bug the current formula replaced: dividing gross
    // by CALENDAR days (e.g. 31) while lopDays counted only WORKING days
    // (e.g. 21) meant someone absent every single working day was
    // docked only 21/31 of their salary and still took home roughly a
    // third of it. Dividing by the same working-day universe the
    // absence was measured in (payableDays) must make a fully-absent
    // month deduct the entire salary, landing at exactly zero net pay —
    // not some fraction of it.
    const calc = calculatePayroll({ basic: 10000, hra: 5000, specialAllowance: 0, bonus: 0, incentives: 0, lopDays: 22, payableDays: 22 });
    expect(calc.lopDeduction).toBe(15000); // the full gross
    expect(calc.pfDeduction).toBe(0);
    expect(calc.esiDeduction).toBe(0);
    expect(calc.professionalTax).toBe(0);
    expect(calc.netSalary).toBe(0);
  });

  test("LOP deduction can never exceed the gross salary, however extreme the inputs", () => {
    const calc = calculatePayroll({ basic: 1000, hra: 0, specialAllowance: 0, bonus: 0, incentives: 0, lopDays: 1000, payableDays: 20 });
    expect(calc.lopDeduction).toBe(1000); // clamped to gross, not the raw (huge) formula result
    expect(calc.netSalary).toBe(0);
  });

  test("net salary is never negative even in extreme deduction scenarios", () => {
    const calc = calculatePayroll({ basic: 500, hra: 0, specialAllowance: 0, bonus: 0, incentives: 0, lopDays: 30, payableDays: 22, state: "Tamil Nadu" });
    expect(calc.netSalary).toBeGreaterThanOrEqual(0);
  });

  test("net salary equals gross minus LOP minus every statutory deduction, when nothing is floored", () => {
    // A modest, non-extreme LOP (well short of full-month absence) keeps
    // this simple algebraic identity intact: net = gross - lop - pf -
    // esi - pt - tds. Verifies the deductions actually wire together
    // consistently, not just that each field individually looks plausible.
    const calc = calculatePayroll({ basic: 45000, hra: 18000, specialAllowance: 5000, bonus: 10000, incentives: 2000, overtime: 1200, lopDays: 2, payableDays: 28, state: "Tamil Nadu" });
    const expectedNet = calc.grossSalary - calc.lopDeduction - calc.pfDeduction - calc.esiDeduction - calc.professionalTax - calc.tds;
    expect(calc.netSalary).toBe(expectedNet);
  });
});

test.describe("professionalTaxFor — state-specific slabs", () => {
  test("Karnataka: flat ₹200 above ₹24,999, nothing at or below", () => {
    expect(professionalTaxFor(24999, "Karnataka")).toBe(0);
    expect(professionalTaxFor(25000, "Karnataka")).toBe(200);
    expect(professionalTaxFor(100000, "Karnataka")).toBe(200);
  });

  test("Tamil Nadu: multi-band slab picks the correct tier", () => {
    expect(professionalTaxFor(20000, "Tamil Nadu")).toBe(0);
    expect(professionalTaxFor(30000, "Tamil Nadu")).toBe(135);
    expect(professionalTaxFor(50000, "Tamil Nadu")).toBe(690);
    expect(professionalTaxFor(80000, "Tamil Nadu")).toBe(1250);
  });

  test("Delhi (and other no-PT states) always levy zero regardless of salary", () => {
    expect(professionalTaxFor(5000, "Delhi")).toBe(0);
    expect(professionalTaxFor(500000, "Delhi")).toBe(0);
    expect(professionalTaxFor(500000, "Haryana")).toBe(0);
  });

  test("an unknown or unset state falls back to the documented ₹200-above-₹15,000 default, not zero", () => {
    expect(professionalTaxFor(10000, "Atlantis")).toBe(0);
    expect(professionalTaxFor(20000, "Atlantis")).toBe(200);
    expect(professionalTaxFor(20000, null)).toBe(200);
    expect(professionalTaxFor(20000, undefined)).toBe(200);
  });

  test("hasKnownPtSchedule distinguishes a real slab table from the silent fallback", () => {
    expect(hasKnownPtSchedule("Karnataka")).toBe(true);
    expect(hasKnownPtSchedule("Delhi")).toBe(true); // known — explicitly zero, not "we don't know"
    expect(hasKnownPtSchedule("Atlantis")).toBe(false);
    expect(hasKnownPtSchedule(null)).toBe(false);
  });
});

test.describe("working-days helpers", () => {
  test("isWeekend correctly identifies Saturday and Sunday, not Friday/Monday", () => {
    expect(isWeekend(new Date("2027-01-02T00:00:00Z"))).toBe(true); // Saturday
    expect(isWeekend(new Date("2027-01-03T00:00:00Z"))).toBe(true); // Sunday
    expect(isWeekend(new Date("2027-01-01T00:00:00Z"))).toBe(false); // Friday
    expect(isWeekend(new Date("2027-01-04T00:00:00Z"))).toBe(false); // Monday
  });

  test("isWorkingDay excludes both weekends and declared holidays", () => {
    const holidays = new Set(["2027-01-01"]); // a Friday, declared a holiday
    expect(isWorkingDay(new Date("2027-01-01T00:00:00Z"), holidays)).toBe(false); // holiday
    expect(isWorkingDay(new Date("2027-01-02T00:00:00Z"), holidays)).toBe(false); // Saturday
    expect(isWorkingDay(new Date("2027-01-04T00:00:00Z"), holidays)).toBe(true); // ordinary Monday
  });

  test("countWorkingDays over a known 7-day range with one mid-week holiday", () => {
    // Mon 2027-01-04 .. Sun 2027-01-10: 5 weekdays, minus 1 holiday (Wed) = 4
    const count = countWorkingDays("2027-01-04", "2027-01-10", new Set(["2027-01-06"]));
    expect(count).toBe(4);
  });

  test("workingDaysInMonth for a known month, hand-counted", () => {
    // January 2027: Jan 1 is a Friday. 31 days -> 5 full weeks (Mon-Fri =
    // 5 weekdays each, but week boundaries mean: weekends fall on
    // (2,3),(9,10),(16,17),(23,24),(30,31) = 10 weekend days -> 21 weekdays.
    expect(workingDaysInMonth(1, 2027, new Set())).toBe(21);
  });
});

test.describe("computeLopDays", () => {
  // March 2095 — far future, guaranteed no real attendance/leave data.
  // Independently enumerate every weekday in the month right here
  // (not by importing isWeekend) so this test doesn't validate the
  // implementation against itself.
  const MONTH = 3;
  const YEAR = 2095;
  const weekdays: string[] = [];
  for (let day = 1; day <= 31; day++) {
    const d = new Date(Date.UTC(YEAR, MONTH - 1, day));
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) weekdays.push(d.toISOString().slice(0, 10));
  }

  test("present days, full paid leave days, a half-leave day, and a holiday are all excluded from LOP — only truly uncovered weekdays count", () => {
    const present = new Set([weekdays[0], weekdays[1]]);
    const paidLeave = new Set([weekdays[2], weekdays[3], weekdays[4]]);
    const halfLeave = new Set([weekdays[4]]); // one of the paid-leave days is only a half day
    const holidays = new Set([weekdays[5]]);
    // Remaining weekdays (index 6 onward) are genuinely uncovered -> full LOP each.
    const uncoveredCount = weekdays.length - 6;
    const expectedLop = uncoveredCount + 0.5; // the half-leave day contributes 0.5

    const lop = computeLopDays(MONTH, YEAR, present, paidLeave, holidays, halfLeave);
    expect(lop).toBe(expectedLop);
  });

  test("zero attendance and zero leave means every weekday in the month is Loss of Pay", () => {
    const lop = computeLopDays(MONTH, YEAR, new Set(), new Set(), new Set());
    expect(lop).toBe(weekdays.length);
  });

  test("approved UNPAID leave does not cover a day — it's still counted as LOP", () => {
    // computeLopDays only receives paidLeaveDates; the caller (payroll
    // generate route) deliberately excludes leave_type === 'unpaid' from
    // that set before calling this — simulated here by simply not
    // including the day in paidLeaveDates at all.
    const lop = computeLopDays(MONTH, YEAR, new Set(), new Set(), new Set());
    expect(lop).toBe(weekdays.length); // nothing covers any day, including the "unpaid leave" day
  });

  test("a weekend or holiday with no attendance is never counted as LOP", () => {
    // Every single day of the month is a holiday -> zero LOP regardless
    // of zero attendance, since weekends are already excluded and every
    // remaining weekday is now also covered by the holiday calendar.
    const allDaysHolidays = new Set<string>();
    for (let day = 1; day <= 31; day++) {
      allDaysHolidays.add(new Date(Date.UTC(YEAR, MONTH - 1, day)).toISOString().slice(0, 10));
    }
    const lop = computeLopDays(MONTH, YEAR, new Set(), new Set(), allDaysHolidays);
    expect(lop).toBe(0);
  });
});
