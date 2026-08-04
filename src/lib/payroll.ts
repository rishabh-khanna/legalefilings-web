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
};

export type PayrollCalculation = {
  grossSalary: number;
  pfDeduction: number;
  esiDeduction: number;
  professionalTax: number;
  tds: number;
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

  const netSalary = grossSalary - pfDeduction - esiDeduction - professionalTax - tds;

  return { grossSalary, pfDeduction, esiDeduction, professionalTax, tds, netSalary };
}
