import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { calculatePayroll } from "@/lib/payroll";

// POST /api/payroll/generate — admin only. For the given month/year,
// generates a payslip for every staff member who has a salary structure,
// using their most recent structure effective on or before that month.
// Idempotent per employee: skips anyone who already has a payslip for
// that month/year (the unique constraint on payslips also backstops
// this) rather than overwriting an already-generated payslip.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const month = Number(body?.month);
  const year = Number(body?.year);
  if (!month || month < 1 || month > 12 || !year) {
    return NextResponse.json({ error: "Valid month (1-12) and year are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const periodEnd = `${year}-${String(month).padStart(2, "0")}-28`;

  const { data: structures, error: structError } = await supabase
    .from("salary_structures")
    .select("*")
    .lte("effective_from", periodEnd)
    .order("effective_from", { ascending: false });
  if (structError) return NextResponse.json({ error: structError.message }, { status: 500 });

  // Keep only the most recent structure per staff member.
  const latestByStaff = new Map<string, (typeof structures)[number]>();
  for (const s of structures ?? []) {
    if (!latestByStaff.has(s.staff_id)) latestByStaff.set(s.staff_id, s);
  }

  const { data: existing } = await supabase.from("payslips").select("staff_id").eq("month", month).eq("year", year);
  const alreadyGenerated = new Set((existing ?? []).map((p) => p.staff_id));

  const toInsert = [];
  for (const [staffId, s] of latestByStaff) {
    if (alreadyGenerated.has(staffId)) continue;
    const calc = calculatePayroll({
      basic: Number(s.basic),
      hra: Number(s.hra),
      specialAllowance: Number(s.special_allowance),
      bonus: Number(s.bonus),
      incentives: Number(s.incentives),
    });
    toInsert.push({
      staff_id: staffId,
      month,
      year,
      basic: s.basic,
      hra: s.hra,
      special_allowance: s.special_allowance,
      bonus: s.bonus,
      incentives: s.incentives,
      overtime: 0,
      pf_deduction: calc.pfDeduction,
      esi_deduction: calc.esiDeduction,
      professional_tax: calc.professionalTax,
      tds: calc.tds,
      gross_salary: calc.grossSalary,
      net_salary: calc.netSalary,
      generated_by: profile.id,
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ ok: true, generated: 0, message: "No new payslips to generate — everyone with a salary structure already has one for this period." });
  }

  const { error: insertError } = await supabase.from("payslips").insert(toInsert);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ ok: true, generated: toInsert.length });
}
