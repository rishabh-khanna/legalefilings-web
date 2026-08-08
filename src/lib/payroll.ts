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
  daysInMonth?: number;
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
const PROFESSIONAL_TAX_FLAT = 200; // Simplified flat slab — actual PT varies by state.
const PROFESSIONAL_TAX_THRESHOLD = 15000;

export function calculatePayroll(input: SalaryStructureInput): PayrollCalculation {
  const overtime = input.overtime ?? 0;
  const grossSalary = input.basic + input.hra + input.specialAllowance + input.bonus + input.incentives + overtime;

  const pfDeduction = Math.round(input.basic * PF_RATE);
  const esiDeduction = grossSalary <= ESI_WAGE_CEILING ? Math.round(grossSalary * ESI_RATE) : 0;
  const professionalTax = grossSalary > PROFESSIONAL_TAX_THRESHOLD ? PROFESSIONAL_TAX_FLAT : 0;
  const tds = 0; // Left to manual entry — income tax withholding depends on the employee's full tax situation.

  // Standard simplified LOP formula: gross ÷ days-in-month × days lost.
  const lopDays = input.lopDays ?? 0;
  const daysInMonth = input.daysInMonth ?? 30;
  const lopDeduction = lopDays > 0 && daysInMonth > 0 ? Math.round((grossSalary / daysInMonth) * lopDays) : 0;

  const netSalary = grossSalary - pfDeduction - esiDeduction - professionalTax - tds - lopDeduction;

  return { grossSalary, pfDeduction, esiDeduction, professionalTax, tds, lopDeduction, netSalary };
}

// Working weekdays (Mon–Sun minus Sat/Sun) in a given month — the
// baseline days someone is expected to be present or on approved leave
// for. Deliberately doesn't exclude company holidays (see the holidays
// table) — same "simple, documented default" tradeoff as the rest of
// this module, not a full attendance-compliance engine.
export function workingDaysInMonth(month: number, year: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dow = new Date(year, month - 1, day).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// LOP days for one staff member in one month: every working weekday
// that has neither a check-in nor approved paid leave covering it.
// Approved UNPAID leave counts as a working day with no coverage (i.e.
// still LOP) — that's the point of unpaid leave; approved paid/sick/
// casual leave counts as covered, same as actually being present.
export function computeLopDays(
  month: number,
  year: number,
  presentDates: Set<string>, // "YYYY-MM-DD" — has at least one check-in
  paidLeaveDates: Set<string> // "YYYY-MM-DD" — covered by approved leave, leave_type != 'unpaid'
): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let lop = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // weekend, not a working day
    const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!presentDates.has(key) && !paidLeaveDates.has(key)) lop++;
  }
  return lop;
}
