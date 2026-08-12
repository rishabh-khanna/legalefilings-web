import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { canSeeAllOrgs } from "@/lib/organization";
import { getLeaveBalance, type LeaveType } from "@/lib/leave-balance";
import { countWorkingDays, fetchHolidayDates } from "@/lib/working-days";

// Calendar span — used ONLY to reject an end-before-start range. Leave
// *duration* is always working days (see countWorkingDays), never this.
function calendarSpanInclusive(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

// A staff member submitting several separate requests, each individually
// within their remaining balance, could previously get all of them
// approved and end up over the cap — the earlier "hard cap" check only
// compared against already-*approved* `used` days, not days already
// tied up in other still-pending requests for the same type. Pending
// requests count against the cap too, same as approved ones.
async function sumCommittedDays(
  supabase: ReturnType<typeof import("@/lib/supabase-admin").getSupabaseAdmin>,
  staffId: string,
  leaveTypeId: string,
  year: number,
  holidays: Set<string>
): Promise<number> {
  const { data } = await supabase
    .from("leave_requests")
    .select("start_date, end_date, day_fraction")
    .eq("staff_id", staffId)
    .eq("leave_type_id", leaveTypeId)
    .in("status", ["pending", "approved"])
    .gte("start_date", `${year}-01-01`)
    .lte("start_date", `${year}-12-31`);
  return (data ?? []).reduce((sum, r) => sum + countWorkingDays(r.start_date, r.end_date, holidays) * Number(r.day_fraction ?? 1), 0);
}

// A day already covered by another pending/approved request (of any
// leave type, paid or unpaid) can't also be requested again — nothing
// stopped the same calendar day from being double-booked across two
// separate requests before this check existed.
async function hasOverlappingRequest(
  supabase: ReturnType<typeof import("@/lib/supabase-admin").getSupabaseAdmin>,
  staffId: string,
  startDate: string,
  endDate: string
): Promise<boolean> {
  const { data } = await supabase
    .from("leave_requests")
    .select("id")
    .eq("staff_id", staffId)
    .in("status", ["pending", "approved"])
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .limit(1);
  return (data ?? []).length > 0;
}

// Without ?scope=mine: a leader/group_leader sees their own request plus
// their reporting chain's (so they can review their team, not just
// themselves); admin sees everything in their own org; a rater sees only
// their own. This is what the Team Leave Requests admin page wants.
// With ?scope=mine: always just the caller's own requests, regardless of
// role — the personal "My Workspace > Leave" page uses this, since an
// admin/leader applying for their own leave shouldn't see their whole
// team's requests folded into what reads as their personal history.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const mineOnly = searchParams.get("scope") === "mine";

  const supabase = getSupabaseAdmin();
  // organizations(name) only actually matters for a platform_admin, who
  // sees every org's leave requests pooled together here — without it,
  // rows from different orgs are indistinguishable in the list.
  let query = supabase
    .from("leave_requests")
    .select("*, profiles!leave_requests_staff_id_fkey(full_name), leave_types(name, code), organizations(name)")
    .order("created_at", { ascending: false });

  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  if (mineOnly) {
    query = query.eq("staff_id", profile.id);
  } else if (profile.account_type !== "admin" && !canSeeAllOrgs(profile)) {
    const chain = await getReportingChainIds(profile.id);
    query = query.in("staff_id", [profile.id, ...chain]);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // requestedDays — the actual number of leave days a request costs
  // (working days in the range × the half-day fraction), computed the
  // same way approval-time balance math already does, not the raw
  // calendar span between start_date and end_date, which overcounts any
  // weekend or company holiday inside the range. Both /dashboard/leave
  // and /dashboard/admin/leave-requests share this endpoint, so the
  // "Total Days" column on each comes from one calculation, not two
  // that could drift apart. Holidays are org-specific, so this fetches
  // one holiday set per org actually present in the result (covering
  // the earliest start_date to latest end_date across that org's rows)
  // rather than once per row.
  const rows = data ?? [];
  const orgIds = [...new Set(rows.map((r) => r.organization_id as string))];
  const holidaysByOrg = new Map<string, Set<string>>();
  await Promise.all(
    orgIds.map(async (orgId) => {
      const orgRows = rows.filter((r) => r.organization_id === orgId);
      const from = orgRows.reduce((min, r) => (r.start_date < min ? r.start_date : min), orgRows[0].start_date);
      const to = orgRows.reduce((max, r) => (r.end_date > max ? r.end_date : max), orgRows[0].end_date);
      holidaysByOrg.set(orgId, await fetchHolidayDates(supabase, orgId, from, to));
    })
  );
  const withDays = rows.map((r) => ({
    ...r,
    requestedDays: countWorkingDays(r.start_date, r.end_date, holidaysByOrg.get(r.organization_id) ?? new Set()) * Number(r.day_fraction ?? 1),
  }));

  return NextResponse.json({ requests: withDays });
}

// POST /api/leave-requests — either the legacy "leaveType: 'unpaid'"
// path (no balance involved, always allowed — Unpaid Leave is
// deliberately uncapped), or "leaveTypeId" pointing at one of the org's
// configured leave_types. In the latter case the request is hard-capped
// at the remaining balance — a request that would exceed it is rejected
// outright rather than auto-splitting the overflow into a separate
// Unpaid request (an earlier version of this route did that; the user
// asked for a strict block instead — apply within your balance or use
// Unpaid Leave, no silent partial-conversion).
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { leaveTypeId, startDate, endDate, reason, halfDay, halfDayPeriod } = body ?? {};
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
  }
  if (calendarSpanInclusive(startDate, endDate) < 1) {
    return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 });
  }
  // Half-day only makes sense on a single date — half of a multi-day
  // range is ambiguous, and the DB constraint rejects it anyway, so
  // catch it here with a message rather than a raw constraint error.
  const dayFraction = halfDay === true ? 0.5 : 1;
  if (dayFraction === 0.5 && startDate !== endDate) {
    return NextResponse.json({ error: "A half day has to be a single date — set the same start and end date." }, { status: 400 });
  }
  const period = dayFraction === 0.5 ? (halfDayPeriod === "second_half" ? "second_half" : "first_half") : null;

  // No backdating. Leave applied for after the fact can paper over an
  // absence payroll has already run on, which quietly reverses that
  // month's loss-of-pay. A genuine retrospective correction is a
  // deliberate admin action, not something the employee self-serves.
  const todayKey = new Date().toISOString().slice(0, 10);
  if (startDate < todayKey) {
    return NextResponse.json(
      { error: "Leave can't start in the past. Ask your manager to record a past absence for you." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  if (await hasOverlappingRequest(supabase, profile.id, startDate, endDate)) {
    return NextResponse.json({ error: "This date range overlaps another pending or approved leave request." }, { status: 400 });
  }

  if (!leaveTypeId) {
    // Explicit Unpaid — no balance to check.
    const { data, error } = await supabase
      .from("leave_requests")
      .insert({ organization_id: profile.organization_id, staff_id: profile.id, leave_type: "unpaid", start_date: startDate, end_date: endDate, reason: reason ?? null, day_fraction: dayFraction, half_day_period: period })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, requests: [data] }, { status: 201 });
  }

  const { data: leaveType } = await supabase
    .from("leave_types")
    .select("*")
    .eq("id", leaveTypeId)
    .eq("organization_id", profile.organization_id)
    .eq("is_active", true)
    .maybeSingle<LeaveType>();
  if (!leaveType) return NextResponse.json({ error: "Invalid leaveTypeId" }, { status: 400 });

  // Balance is keyed by the leave's own year, not "today" — an
  // end-of-December request for leave starting in January needs next
  // year's balance, not this year's (which is what getLeaveBalance
  // would default to without this).
  const requestYear = new Date(`${startDate}T00:00:00Z`).getUTCFullYear();
  // Holidays for the whole balance year, not just this request's range —
  // sumCommittedDays re-measures every other request in the year and
  // needs the same holiday set to measure them consistently.
  const holidays = await fetchHolidayDates(supabase, profile.organization_id, `${requestYear}-01-01`, `${requestYear}-12-31`);
  const balance = await getLeaveBalance(supabase, profile.id, leaveType, profile.organization_id, profile.date_of_joining, requestYear);
  const alreadyCommitted = await sumCommittedDays(supabase, profile.id, leaveType.id, requestYear, holidays);
  const trueAvailable = balance.available - alreadyCommitted;
  const requestedDays = countWorkingDays(startDate, endDate, holidays) * dayFraction;
  // A range that lands entirely on weekends/holidays costs nothing and
  // means nothing — reject it rather than silently booking a zero-day
  // leave that shows up in the list and blocks the dates.
  if (requestedDays === 0) {
    return NextResponse.json(
      { error: "That range has no working days in it — it falls entirely on weekends or company holidays." },
      { status: 400 }
    );
  }
  if (requestedDays > trueAvailable) {
    return NextResponse.json(
      { error: `Only ${Math.max(0, trueAvailable).toFixed(1)} day${trueAvailable === 1 ? "" : "s"} of ${leaveType.name} available — this request needs ${requestedDays}. Reduce the range or apply for Unpaid Leave instead.` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      organization_id: profile.organization_id,
      staff_id: profile.id,
      leave_type: "paid",
      leave_type_id: leaveType.id,
      start_date: startDate,
      end_date: endDate,
      reason: reason ?? null,
      day_fraction: dayFraction,
      half_day_period: period,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, requests: [data] }, { status: 201 });
}
