import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { hasToolAccess } from "@/lib/tool-grants";

// PATCH /api/leave-types/[id] — update credit/cap/name, or deactivate.
// No hard delete — a type with existing leave_requests/leave_balances
// referencing it can't be removed without orphaning history, so
// "delete" here means is_active = false (hidden from the apply picker,
// existing balances/requests untouched).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "leave_types"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const patch: Record<string, unknown> = {};
  if (typeof body?.name === "string" && body.name.trim()) patch.name = body.name.trim();
  if (typeof body?.annualCreditDays === "number" && body.annualCreditDays >= 0) patch.annual_credit_days = body.annualCreditDays;
  if (typeof body?.carryForwardCap === "number" && body.carryForwardCap >= 0) patch.carry_forward_cap = body.carryForwardCap;
  if (typeof body?.isActive === "boolean") patch.is_active = body.isActive;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("leave_types")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", profile.organization_id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, leaveType: data });
}
