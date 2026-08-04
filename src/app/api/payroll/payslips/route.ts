import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";

// GET /api/payroll/payslips — a staff member sees their own; admin sees
// everyone's (optionally filtered by ?staffId=).
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const requestedStaffId = searchParams.get("staffId");

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("payslips")
    .select("*, profiles!payslips_staff_id_fkey(full_name)")
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (profile.account_type === "admin") {
    if (requestedStaffId) query = query.eq("staff_id", requestedStaffId);
  } else {
    query = query.eq("staff_id", profile.id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payslips: data });
}
