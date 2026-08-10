import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";

// GET /api/admin/email-failures — admin only. Unresolved by default;
// ?includeResolved=1 shows everything.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "email_failures"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const includeResolved = searchParams.get("includeResolved") === "1";

  const supabase = getSupabaseAdmin();
  // organizations(name) only actually matters for a platform_admin, who
  // sees every org's failures pooled together here — without it, there'd
  // be no way to tell which tenant a failed email even belongs to.
  let query = supabase
    .from("email_failures")
    .select("*, organizations(name), resolver:profiles!email_failures_resolved_by_fkey(full_name)")
    .order("created_at", { ascending: false });
  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  if (!includeResolved) query = query.eq("resolved", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ failures: data });
}
