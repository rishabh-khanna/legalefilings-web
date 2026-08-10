import { isWorkingDay, toDateKey } from "@/lib/working-days";
import { professionalTaxFor } from "@/lib/professional-tax";
// Payroll calculation — deliberately simple, documented defaults rather
// than a full statutory compliance engine (real PF/ESI/PT/TDS rules vary
// by state, wage ceiling, and individual tax situation). Admin sets the
// salary structure per employee; these functions compute reasonable
// default deductions that show up as editable numbers on the generated
// payslip — not a substitute for a CA's payroll sign-off.
export type SalaryStructureInput = {
  basic: number;
  hra: number;
  specialAllowance: number;
  bonus: number;
  incentives: number;
  overtime?: number;
  // Loss of Pay — working days in this period with neither a check-in
  // nor approved paid leave (see computeLopDays below). Optional and
  // defaults to 0 so every existing caller/behavior is unchanged unless
  // it actually passes attendance-derived numbers.
  lopDays?: number;
  // Working days in the period — the same universe lopDays is counted
  // in. Named payableDays, not daysInMonth, because passing calendar
  // days here is exactly the bug this replaced.
  payableDays?: number;
  // The employing organization's state (company_settings.state) —
  // Professional Tax is a state levy with materially different slabs,
  // and several states don't levy it at all.
  state?: string | null;
};

export type PayrollCalculation = {
  grossSalary: number;
  pfDeduction: number;
  esiDeduction: number;
  professionalTax: number;
  tds: number;
  lopDeduction: number;
  netSalary: number;
};

const PF_RATE = 0.12; // Employee PF contribution — standard 12% of basic.
const ESI_RATE = 0.0075; // Employee ESI contribution — 0.75% of gross.
const ESI_WAGE_CEILING = 21000; // ESI only applies below this gross monthly wage.
// PF is capped at the ₹15,000 statutory wage ceiling. Applying 12% to
// the full basic above that over-deducted from every higher earner —
// the ceiling is the whole reason the rule is written as a ceiling.
const PF_WAGE_CEILING = 15000;

export function calculatePayroll(input: SalaryStructureInput): PayrollCalculation {
  const overtime = input.overtime ?? 0;
  const grossSalary = input.basic + input.hra + input.specialAllowance + input.bonus + input.incentives + overtime;

  // Loss of Pay, on a WORKING-day basis.
  //
  // This used to divide gross by calendar days (31) while lopDays counted
  // only working days (21) — two different day universes on either side
  // of the same formula. Someone absent every single working day of a
  // month was therefore docked 21/31 of their salary and still took home
  // roughly a third of it for zero attendance. Dividing by the same
  // working-day count the absence was measured in makes a full month of
  // absence deduct a full month of pay, and it correctly makes each
  // absent day cost more in a month with more holidays.
  const lopDays = input.lopDays ?? 0;
  const payableDays = input.payableDays && input.payableDays > 0 ? input.payableDays : 0;
  const rawLop = lopDays > 0 && payableDays > 0 ? (grossSalary / payableDays) * lopDays : 0;
  // Can't lose more than the whole salary, however the inputs arrive.
  const lopDeduction = Math.round(Math.min(rawLop, grossSalary));

  // Statutory deductions apply to what was actually EARNED, not to the
  // full salary structure — you don't owe PF or Professional Tax on pay
  // you never received. Computing them on the un-reduced gross while
  // separately subtracting LOP could push net below zero and produce a
  // payslip demanding money from the employee.
  const earnedGross = Math.max(0, grossSalary - lopDeduction);
  const earnedRatio = grossSalary > 0 ? earnedGross / grossSalary : 0;
  const earnedBasic = input.basic * earnedRatio;

  const pfDeduction = Math.round(Math.min(earnedBasic, PF_WAGE_CEILING) * PF_RATE);
  const esiDeduction = earnedGross > 0 && earnedGross <= ESI_WAGE_CEILING ? Math.round(earnedGross * ESI_RATE) : 0;
  const professionalTax = earnedGross > 0 ? professionalTaxFor(earnedGross, input.state) : 0;
  const tds = 0; // Left to manual entry — income tax withholding depends on the employee's full tax situation.

  const netSalary = Math.max(0, earnedGross - pfDeduction - esiDeduction - professionalTax - tds);

  return { grossSalary, pfDeduction, esiDeduction, professionalTax, tds, lopDeduction, netSalary };
}

// LOP days for one staff member in one month: every working day that has
// neither a check-in nor approved paid leave covering it. Approved UNPAID
// leave counts as a working day with no coverage (i.e. still LOP) —
// that's the point of unpaid leave; approved paid/sick/casual leave
// counts as covered, same as actually being present.
//
// "Working day" now means the shared definition in lib/working-days —
// not a weekend AND not a company holiday. Holidays were previously
// ignored here, so anyone who (correctly) didn't clock in on a declared
// holiday was counted as loss-of-pay and docked for it.
export function computeLopDays(
  month: number,
  year: number,
  presentDates: Set<string>, // "YYYY-MM-DD" — has at least one check-in
  paidLeaveDates: Set<string>, // "YYYY-MM-DD" — covered by approved leave, leave_type != 'unpaid'
  holidays: Set<string> = new Set(), // "YYYY-MM-DD" — declared company holidays
  halfLeaveDates: Set<string> = new Set() // covered by a HALF day of paid leave
): number {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let lop = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const key = toDateKey(date);
    if (!isWorkingDay(date, holidays)) continue;
    if (presentDates.has(key)) continue;
    if (paidLeaveDates.has(key)) {
      // Half a day of leave leaves half a day uncovered — unless they
      // also clocked in, which the check above already handled.
      if (halfLeaveDates.has(key)) lop += 0.5;
      continue;
    }
    lop++;
  }
  return lop;
}
