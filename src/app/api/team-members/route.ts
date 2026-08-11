import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { canSeeAllOrgs } from "@/lib/organization";

// GET /api/team-members — the staff/admin list a given viewer is allowed
// to act on: admin gets everyone in their own organization (a
// platform_admin gets literally everyone, across every org — the one
// deliberate cross-tenant view in this app), anyone else gets themselves
// plus their reporting chain. Centralizes "who can I see" so every
// staff-picker in the app (attendance, leads viewer, etc.) shows the
// same scoped list instead of leaking the full org chart to a rater —
// or, now, another organization's entire team to this one's admin.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  if (profile.account_type === "admin") {
    // organizations(name) only actually matters for a platform_admin —
    // that's the one case where this list spans more than one org, and
    // without it, two different orgs' same-named seed/test accounts
    // (or just a coincidence of two real "Alpha Admin"-style names)
    // render as what looks like duplicate rows in every picker built on
    // this endpoint, with no way to tell which org either one belongs
    // to short of guessing.
    // organizations!organization_id disambiguates the embed — profiles
    // now has more than one FK to organizations, so PostgREST can't
    // infer which relationship "organizations(name)" means on its own.
    let query = supabase.from("profiles").select("id, full_name, organization_id, organizations!organization_id(name)").in("account_type", ["staff", "admin"]);
    if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      members: (data ?? []).map((m) => ({ id: m.id, full_name: m.full_name, organizationName: (m.organizations as unknown as { name: string } | null)?.name ?? null })),
    });
  }

  const chainIds = await getReportingChainIds(profile.id);
  const ids = [profile.id, ...chainIds];
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data });
}
