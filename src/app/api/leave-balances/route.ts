import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canApproveFor } from "@/lib/reporting-chain";
import { getLeaveBalance, type LeaveType } from "@/lib/leave-balance";

// GET /api/leave-balances?staffId=... — every active leave type in the
// org, with the caller's (or, for a manager/admin, ?staffId=' target's)
// carried-forward / accrued-so-far / used / available breakdown for the
// current calendar year. Defaults to the caller's own balances.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const requestedStaffId = searchParams.get("staffId");
  const staffId = requestedStaffId && requestedStaffId !== profile.id ? requestedStaffId : profile.id;

  if (staffId !== profile.id && !(await canApproveFor(profile, staffId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: staffProfile } = await supabase.from("profiles").select("organization_id, date_of_joining").eq("id", staffId).maybeSingle();
  if (!staffProfile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Every leave type, not just active ones — a type deactivated mid-year
  // used to disappear from this list entirely, taking this staff
  // member's own carried-forward/used/available numbers for it out of
  // view even though the underlying rows were untouched. An inactive
  // type is only included here if this staff member actually has a
  // balance row for it (i.e. real history to show); an inactive type
  // nobody's touched stays hidden, same as before.
  const currentYear = new Date().getUTCFullYear();
  const [{ data: leaveTypes }, { data: existingBalances }] = await Promise.all([
    supabase.from("leave_types").select("*").eq("organization_id", staffProfile.organization_id).order("name"),
    supabase.from("leave_balances").select("leave_type_id").eq("staff_id", staffId).eq("year", currentYear),
  ]);
  const typeIdsWithHistory = new Set((existingBalances ?? []).map((b) => b.leave_type_id));
  const visibleTypes = ((leaveTypes ?? []) as LeaveType[]).filter((lt) => lt.is_active || typeIdsWithHistory.has(lt.id));

  const balances = await Promise.all(
    visibleTypes.map((lt) => getLeaveBalance(supabase, staffId, lt, staffProfile.organization_id, staffProfile.date_of_joining, currentYear))
  );

  return NextResponse.json({ balances });
}
