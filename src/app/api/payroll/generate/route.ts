import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { calculatePayroll, computeLopDays } from "@/lib/payroll";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";

// POST /api/payroll/generate — admin only. For the given month/year,
// generates a payslip for every staff member who has a salary structure,
// using their most recent structure effective on or before that month.
// Idempotent per employee: skips anyone who already has a payslip for
// that month/year (the unique constraint on payslips also backstops
// this) rather than overwriting an already-generated payslip.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "payroll"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const month = Number(body?.month);
  const year = Number(body?.year);
  if (!month || month < 1 || month > 12 || !year) {
    return NextResponse.json({ error: "Valid month (1-12) and year are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const periodEnd = `${year}-${String(month).padStart(2, "0")}-28`;

  let structQuery = supabase
    .from("salary_structures")
    .select("*")
    .lte("effective_from", periodEnd)
    .order("effective_from", { ascending: false });
  if (!canSeeAllOrgs(profile)) structQuery = structQuery.eq("organization_id", profile.organization_id);
  const { data: structures, error: structError } = await structQuery;
  if (structError) return NextResponse.json({ error: structError.message }, { status: 500 });

  // Keep only the most recent structure per staff member.
  const latestByStaff = new Map<string, (typeof structures)[number]>();
  for (const s of structures ?? []) {
    if (!latestByStaff.has(s.staff_id)) latestByStaff.set(s.staff_id, s);
  }

  const { data: existing } = await supabase.from("payslips").select("staff_id").eq("month", month).eq("year", year);
  const alreadyGenerated = new Set((existing ?? []).map((p) => p.staff_id));

  const staffIds = Array.from(latestByStaff.keys()).filter((id) => !alreadyGenerated.has(id));
  const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const periodEndExact = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  // Loss of Pay inputs — pulled once for every staff member being paid
  // this run, then grouped in-memory below (see computeLopDays in
  // src/lib/payroll.ts for what actually counts as covered vs. LOP).
  const [{ data: checkIns }, { data: approvedLeave }] = staffIds.length
    ? await Promise.all([
        supabase
          .from("attendance_events")
          .select("staff_id, occurred_at")
          .eq("event_type", "check_in")
          .in("staff_id", staffIds)
          .gte("occurred_at", `${periodStart}T00:00:00Z`)
          .lt("occurred_at", `${nextMonthYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00Z`),
        supabase
          .from("leave_requests")
          .select("staff_id, leave_type, start_date, end_date")
          .eq("status", "approved")
          .in("staff_id", staffIds)
          .lte("start_date", periodEndExact)
          .gte("end_date", periodStart),
      ])
    : [{ data: [] }, { data: [] }];

  const presentDatesByStaff = new Map<string, Set<string>>();
  for (const row of checkIns ?? []) {
    const dateKey = String(row.occurred_at).slice(0, 10);
    if (!presentDatesByStaff.has(row.staff_id)) presentDatesByStaff.set(row.staff_id, new Set());
    presentDatesByStaff.get(row.staff_id)!.add(dateKey);
  }

  const paidLeaveDatesByStaff = new Map<string, Set<string>>();
  for (const leave of approvedLeave ?? []) {
    if (leave.leave_type === "unpaid") continue; // unpaid leave is deliberately NOT covered — that's the point of it
    if (!paidLeaveDatesByStaff.has(leave.staff_id)) paidLeaveDatesByStaff.set(leave.staff_id, new Set());
    const set = paidLeaveDatesByStaff.get(leave.staff_id)!;
    const from = leave.start_date < periodStart ? periodStart : leave.start_date;
    const to = leave.end_date > periodEndExact ? periodEndExact : leave.end_date;
    for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
      set.add(d.toISOString().slice(0, 10));
    }
  }

  const toInsert = [];
  for (const [staffId, s] of latestByStaff) {
    if (alreadyGenerated.has(staffId)) continue;
    const lopDays = computeLopDays(month, year, presentDatesByStaff.get(staffId) ?? new Set(), paidLeaveDatesByStaff.get(staffId) ?? new Set());
    const calc = calculatePayroll({
      basic: Number(s.basic),
      hra: Number(s.hra),
      specialAllowance: Number(s.special_allowance),
      bonus: Number(s.bonus),
      incentives: Number(s.incentives),
      lopDays,
      daysInMonth,
    });
    toInsert.push({
      organization_id: s.organization_id,
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
      lop_days: lopDays,
      lop_deduction: calc.lopDeduction,
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
