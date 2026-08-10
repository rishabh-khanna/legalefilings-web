import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canApproveFor } from "@/lib/reporting-chain";
import { creditLeaveBalanceUsed, type LeaveType } from "@/lib/leave-balance";
import { countWorkingDays, fetchHolidayDates } from "@/lib/working-days";
import { hasToolAccess } from "@/lib/tool-grants";

// PATCH /api/leave-requests/[id] — approve, reject, or cancel.
//
// Approve/reject: admin can act on anyone; anyone else must be the
// requester's *direct* manager (one level up, not any level up the
// chain) — see canApproveFor. Never the requester themselves.
//
// Cancel: the requester withdrawing their own, or anyone who could have
// approved it. Works on a pending request (a withdrawal, nothing was
// ever consumed) or an approved one (the days are handed back). Blocked
// once the leave has started — at that point the person was actually
// absent, and returning the balance would pay them for days off they
// genuinely took.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  // A customer delegated Team Leave Requests approves/rejects/cancels
  // through this same route — canApproveFor already treats a granted
  // customer as org-wide, same as admin.
  const isCustomerOperator = profile?.account_type === "customer" && (await hasToolAccess(profile, "team_leave"));
  if (!profile || (profile.account_type === "customer" && !isCustomerOperator)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const decision = body?.decision;
  if (decision !== "approve" && decision !== "reject" && decision !== "cancel") {
    return NextResponse.json({ error: "decision must be 'approve', 'reject', or 'cancel'" }, { status: 400 });
  }
  if (decision === "reject" && !String(body?.reason ?? "").trim()) {
    return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("leave_requests")
    .select("staff_id, status, organization_id, leave_type_id, start_date, end_date, day_fraction")
    .eq("id", id)
    .single();
  if (!existing) return NextResponse.json({ error: "Request not found" }, { status: 404 });

  if (decision === "cancel") {
    return cancelLeave(supabase, profile, id, existing);
  }

  if (existing.status !== "pending") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

  if (!(await canApproveFor(profile, existing.staff_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("leave_requests")
    .update({
      status: decision === "approve" ? "approved" : "rejected",
      reviewed_by: profile.id,
      review_note: decision === "reject" ? String(body.reason) : null,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Request not found or already reviewed" }, { status: 404 });

  // Credit the days against the requester's balance — only for requests
  // tied to a real leave_type (Unpaid has leave_type_id null and no
  // balance to touch). The year is keyed off start_date, not "now" — a
  // request approved in January for December leave should hit December's
  // year, not whatever year the approval click happens to land in.
  if (decision === "approve" && existing.leave_type_id) {
    const { data: leaveType } = await supabase.from("leave_types").select("*").eq("id", existing.leave_type_id).maybeSingle<LeaveType>();
    if (leaveType) {
      const year = new Date(`${existing.start_date}T00:00:00Z`).getUTCFullYear();
      // Working days, matching exactly how the request was measured
      // against the balance at submit time — crediting calendar days
      // here would deduct more than was ever reserved.
      const holidays = await fetchHolidayDates(supabase, existing.organization_id, existing.start_date, existing.end_date);
      const days = countWorkingDays(existing.start_date, existing.end_date, holidays) * Number(existing.day_fraction ?? 1);
      await creditLeaveBalanceUsed(supabase, existing.staff_id, leaveType, existing.organization_id, year, days);
    }
  }

  return NextResponse.json({ ok: true, request: data });
}

type ExistingLeave = {
  staff_id: string;
  status: string;
  organization_id: string;
  leave_type_id: string | null;
  start_date: string;
  end_date: string;
  day_fraction?: number | string | null;
};

async function cancelLeave(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  profile: NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>,
  id: string,
  existing: ExistingLeave
) {
  if (existing.status !== "pending" && existing.status !== "approved") {
    return NextResponse.json(
      { error: `A ${existing.status} leave request can't be cancelled.` },
      { status: 409 }
    );
  }

  // Own request, or someone senior enough to have approved it.
  const isOwn = existing.staff_id === profile.id;
  if (!isOwn && !(await canApproveFor(profile, existing.staff_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  if (existing.start_date <= todayKey) {
    return NextResponse.json(
      { error: "This leave has already started — it can't be cancelled. Ask an admin to correct the record instead." },
      { status: 400 }
    );
  }

  // Claim the row with the status flip, re-checking the status in the
  // WHERE clause — two cancels racing (double-click, retry) must not
  // both proceed to hand the balance back twice.
  const { data, error } = await supabase
    .from("leave_requests")
    .update({
      status: "cancelled",
      reviewed_by: profile.id,
      review_note: isOwn ? "Withdrawn by the requester" : `Cancelled by ${profile.full_name ?? "a manager"}`,
    })
    .eq("id", id)
    .eq("status", existing.status)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "This request was already actioned." }, { status: 409 });

  // Only an *approved* request ever consumed balance — a pending one was
  // reserved by sumCommittedDays, which counts live requests and stops
  // counting this one the moment its status changes. Unpaid leave has no
  // leave_type_id and no balance to return.
  if (existing.status === "approved" && existing.leave_type_id) {
    const { data: leaveType } = await supabase.from("leave_types").select("*").eq("id", existing.leave_type_id).maybeSingle<LeaveType>();
    if (leaveType) {
      const year = new Date(`${existing.start_date}T00:00:00Z`).getUTCFullYear();
      // Measured identically to how it was consumed at approval, so the
      // credit and the debit are always the same number of days.
      const holidays = await fetchHolidayDates(supabase, existing.organization_id, existing.start_date, existing.end_date);
      const days = countWorkingDays(existing.start_date, existing.end_date, holidays) * Number(existing.day_fraction ?? 1);
      await creditLeaveBalanceUsed(supabase, existing.staff_id, leaveType, existing.organization_id, year, -days);
    }
  }

  return NextResponse.json({ ok: true, request: data });
}
