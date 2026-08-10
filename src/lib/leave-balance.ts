import type { getSupabaseAdmin } from "@/lib/supabase-admin";

export type LeaveType = {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  annual_credit_days: number;
  carry_forward_cap: number;
  is_active: boolean;
};

export type LeaveBalance = {
  leaveType: LeaveType;
  year: number;
  carriedForward: number;
  accrued: number;
  used: number;
  available: number;
};

// Monthly accrual computed on read, not via a scheduled job — this repo
// has no cron infrastructure, and computing "credit / 12 * whole months
// elapsed since Jan 1 (or, if later, this person's joining date)" from
// the current date produces the exact number a monthly cron would have
// landed on, without needing one. Capped at the full annual amount once
// 12 months have elapsed (or the year is a past, fully-elapsed year).
export function computeAccruedDays(annualCreditDays: number, year: number, joinDate: string | null, asOf: Date = new Date()): number {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const joined = joinDate ? new Date(joinDate) : null;
  const accrualStart = joined && joined > yearStart ? joined : yearStart;

  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const effectiveNow = asOf < yearEnd ? asOf : yearEnd;
  if (effectiveNow <= accrualStart) return 0;

  let months = (effectiveNow.getUTCFullYear() - accrualStart.getUTCFullYear()) * 12 + (effectiveNow.getUTCMonth() - accrualStart.getUTCMonth());
  if (effectiveNow.getUTCDate() < accrualStart.getUTCDate()) months -= 1;
  months = Math.max(0, Math.min(12, months));

  return Math.round(((annualCreditDays / 12) * months + Number.EPSILON) * 100) / 100;
}

// Carry-forward is computed by looking at the immediately preceding
// year's row ONLY (not a chain back to org founding) — if that row was
// never created (this staff member never looked up or used this leave
// type last year), carried_forward defaults to 0 rather than walking
// further back. New feature, so there's no historical ledger to
// reconstruct anyway.
async function computeCarriedForward(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  staffId: string,
  leaveType: LeaveType,
  year: number
): Promise<number> {
  if (leaveType.carry_forward_cap <= 0) return 0;

  const { data: prior } = await supabase
    .from("leave_balances")
    .select("carried_forward, used")
    .eq("staff_id", staffId)
    .eq("leave_type_id", leaveType.id)
    .eq("year", year - 1)
    .maybeSingle();
  if (!prior) return 0;

  const { data: profile } = await supabase.from("profiles").select("date_of_joining").eq("id", staffId).maybeSingle();
  const priorAccrued = computeAccruedDays(leaveType.annual_credit_days, year - 1, profile?.date_of_joining ?? null, new Date(Date.UTC(year, 0, 1)));
  const priorUnused = Math.max(0, Number(prior.carried_forward) + priorAccrued - Number(prior.used));
  return Math.min(priorUnused, leaveType.carry_forward_cap);
}

// Get-or-create this staff member's balance row for one leave type in
// one year — read-only (no credit applied). Use creditLeaveBalanceUsed
// instead when recording an approval; that path is atomic and this one
// is not (a plain upsert-if-missing), so it must never be used as half
// of a read-then-write increment.
export async function getOrCreateBalance(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  staffId: string,
  leaveType: LeaveType,
  organizationId: string,
  year: number
): Promise<{ carriedForward: number; used: number }> {
  const { data: existing } = await supabase
    .from("leave_balances")
    .select("carried_forward, used")
    .eq("staff_id", staffId)
    .eq("leave_type_id", leaveType.id)
    .eq("year", year)
    .maybeSingle();
  if (existing) return { carriedForward: Number(existing.carried_forward), used: Number(existing.used) };

  const carriedForward = await computeCarriedForward(supabase, staffId, leaveType, year);

  // Upsert rather than insert — a concurrent first-touch (two requests
  // racing to create this year's row) loses gracefully to whichever
  // insert wins, instead of erroring the second caller.
  const { data: created } = await supabase
    .from("leave_balances")
    .upsert(
      { staff_id: staffId, leave_type_id: leaveType.id, organization_id: organizationId, year, carried_forward: carriedForward, used: 0 },
      { onConflict: "staff_id,leave_type_id,year", ignoreDuplicates: true }
    )
    .select("carried_forward, used")
    .maybeSingle();
  if (created) return { carriedForward: Number(created.carried_forward), used: Number(created.used) };

  // Lost the upsert race — the winning row is now there; read it.
  const { data: row } = await supabase
    .from("leave_balances")
    .select("carried_forward, used")
    .eq("staff_id", staffId)
    .eq("leave_type_id", leaveType.id)
    .eq("year", year)
    .single();
  return { carriedForward: Number(row?.carried_forward ?? carriedForward), used: Number(row?.used ?? 0) };
}

// Atomically add `days` to this staff member's used count for one leave
// type/year — a single Postgres UPDATE-or-INSERT (see
// increment_leave_balance_used, 20260827000000 migration), not a
// read-then-write from application code. Two leave requests for the
// same staff/type/year approved concurrently both land correctly
// instead of one silently overwriting the other. Called from
// PATCH /api/leave-requests/[id] on approval.
//
// `days` may be negative — that's the cancellation path handing back the
// days an approved request had consumed. The underlying function clamps
// used at zero, so a double-cancel can't manufacture entitlement.
export async function creditLeaveBalanceUsed(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  staffId: string,
  leaveType: LeaveType,
  organizationId: string,
  year: number,
  days: number
): Promise<void> {
  const carriedForward = await computeCarriedForward(supabase, staffId, leaveType, year);
  await supabase.rpc("increment_leave_balance_used", {
    p_staff_id: staffId,
    p_leave_type_id: leaveType.id,
    p_organization_id: organizationId,
    p_year: year,
    p_days: days,
    p_carried_forward: carriedForward,
  });
}

export async function getLeaveBalance(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  staffId: string,
  leaveType: LeaveType,
  organizationId: string,
  joinDate: string | null,
  year: number = new Date().getUTCFullYear()
): Promise<LeaveBalance> {
  const { carriedForward, used } = await getOrCreateBalance(supabase, staffId, leaveType, organizationId, year);
  const accrued = computeAccruedDays(leaveType.annual_credit_days, year, joinDate);
  const available = Math.max(0, carriedForward + accrued - used);
  return { leaveType, year, carriedForward, accrued, used, available };
}

// Best-effort — called during org provisioning alongside the default
// company_settings row. Not rolled back on failure the way the
// organization/company_settings insert chain is: an org missing its two
// starter leave types is a minor inconvenience an admin can fix from
// Admin > Leave Types, not a broken org.
export async function seedDefaultLeaveTypes(supabase: ReturnType<typeof getSupabaseAdmin>, organizationId: string): Promise<void> {
  await supabase.from("leave_types").insert([
    { organization_id: organizationId, name: "Casual Leave", code: "CL", annual_credit_days: 12, carry_forward_cap: 5 },
    { organization_id: organizationId, name: "Sick Leave", code: "SL", annual_credit_days: 12, carry_forward_cap: 5 },
  ]);
}
