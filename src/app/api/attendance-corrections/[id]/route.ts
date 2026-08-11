import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canApproveFor } from "@/lib/reporting-chain";

// PATCH /api/attendance-corrections/[id] — approve or reject. Admin can
// act on anyone; anyone else must be the requester's *direct* manager (one
// level up, not any level up) — see canApproveFor. Never the requester
// themselves. Approving inserts the actual attendance_events rows for that
// day, so the corrected punch shows up in reports the same as a normal
// clock in/out.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  const { data: correction, error: fetchError } = await supabase
    .from("attendance_corrections")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .single();
  if (fetchError || !correction) return NextResponse.json({ error: "Request not found or already reviewed" }, { status: 404 });

  if (!(await canApproveFor(profile, correction.staff_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Claim the row with the status flip FIRST, re-checking status = pending
  // right here (not just in the read above) — two near-simultaneous PATCH
  // calls (double-click, retry) can both pass the read above, but only one
  // of these UPDATEs can actually match a still-pending row. The loser
  // gets zero rows back and stops before ever touching attendance_events,
  // instead of both racing ahead into the insert below.
  const { data, error } = await supabase
    .from("attendance_corrections")
    .update({
      status: decision === "approve" ? "approved" : "rejected",
      reviewed_by: profile.id,
      review_note: decision === "reject" ? String(body.reason) : null,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Request already reviewed" }, { status: 409 });

  if (decision === "approve") {
    const inserts = [];
    if (correction.requested_check_in) {
      inserts.push({
        organization_id: correction.organization_id,
        staff_id: correction.staff_id,
        event_type: "check_in" as const,
        occurred_at: `${correction.date}T${correction.requested_check_in}`,
        note: "regularized",
      });
    }
    if (correction.requested_check_out) {
      inserts.push({
        organization_id: correction.organization_id,
        staff_id: correction.staff_id,
        event_type: "check_out" as const,
        occurred_at: `${correction.date}T${correction.requested_check_out}`,
        note: "regularized",
      });
    }
    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from("attendance_events").insert(inserts);
      if (insertError) {
        // Best-effort: put the request back to pending since the
        // approval didn't actually take effect — otherwise it'd be
        // stuck "approved" with no corresponding attendance events.
        await supabase.from("attendance_corrections").update({ status: "pending", reviewed_by: null, review_note: null }).eq("id", id);
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true, request: data });
}
