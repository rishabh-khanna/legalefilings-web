import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";

// GET /api/team-members — the staff/admin list a given viewer is allowed
// to act on: admin gets everyone, anyone else gets themselves plus their
// reporting chain. Centralizes "who can I see" so every staff-picker in
// the app (attendance, leads viewer, etc.) shows the same scoped list
// instead of leaking the full org chart to a rater.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  if (profile.account_type === "admin") {
    const { data, error } = await supabase.from("profiles").select("id, full_name").in("account_type", ["staff", "admin"]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ members: data });
  }

  const chainIds = await getReportingChainIds(profile.id);
  const ids = [profile.id, ...chainIds];
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data });
}
