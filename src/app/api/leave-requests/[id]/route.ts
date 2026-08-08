import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canApproveFor } from "@/lib/reporting-chain";
import { creditLeaveBalanceUsed, type LeaveType } from "@/lib/leave-balance";

function daysBetweenInclusive(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

// PATCH /api/leave-requests/[id] — approve or reject. Admin can act on
// anyone; anyone else must be the requester's *direct* manager (one level
// up, not any level up the chain) — see canApproveFor. Never the
// requester themselves.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const decision = body?.decision;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "decision must be 'approve' or 'reject'" }, { status: 400 });
  }
  if (decision === "reject" && !String(body?.reason ?? "").trim()) {
    return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("leave_requests")
    .select("staff_id, status, organization_id, leave_type_id, start_date, end_date")
    .eq("id", id)
    .single();
  if (!existing) return NextResponse.json({ error: "Request not found" }, { status: 404 });
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
      const days = daysBetweenInclusive(existing.start_date, existing.end_date);
      await creditLeaveBalanceUsed(supabase, existing.staff_id, leaveType, existing.organization_id, year, days);
    }
  }

  return NextResponse.json({ ok: true, request: data });
}
