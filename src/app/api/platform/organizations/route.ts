import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { createUserWithProfile } from "@/lib/admin-actions";
import { seedDefaultLeaveTypes } from "@/lib/leave-balance";

// GET /api/platform/organizations — platform_admin only. Every tenant
// org plus a headcount, for the Legal Efilings operator's own org
// management screen — not visible to an org's own admin, who only ever
// sees their own organization.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_platform_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data: orgs, error } = await supabase.from("organizations").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: counts } = await supabase.from("profiles").select("organization_id");
  const memberCounts = new Map<string, number>();
  for (const row of counts ?? []) {
    memberCounts.set(row.organization_id, (memberCounts.get(row.organization_id) ?? 0) + 1);
  }

  return NextResponse.json({
    organizations: (orgs ?? []).map((org) => ({ ...org, memberCount: memberCounts.get(org.id) ?? 0 })),
  });
}

// POST /api/platform/organizations — platform_admin only. Provisions a
// brand-new tenant: the organization row, a default company_settings row
// (every org needs one for invoices/documents to render), and that org's
// first admin account — the same auth-user + profile creation helper the
// "quick add user" form uses, so the new admin gets a real, working
// login and temp password immediately, the same way any other account is
// created in this app.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_platform_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const { name, slug, planTier, adminFullName, adminEmail, adminPhone } = body as Record<string, unknown>;
  if (!name || !slug || !adminFullName || !adminEmail) {
    return NextResponse.json({ error: "name, slug, adminFullName, and adminEmail are required" }, { status: 400 });
  }
  const normalizedSlug = String(slug).trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(normalizedSlug)) {
    return NextResponse.json({ error: "slug must be lowercase letters, numbers, and hyphens only" }, { status: 400 });
  }
  const tier = planTier === "starter" || planTier === "business" || planTier === "enterprise" ? planTier : "starter";

  const supabase = getSupabaseAdmin();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({ name: String(name), slug: normalizedSlug, plan_tier: tier, created_by: profile.id })
    .select()
    .single();
  if (orgError) {
    const message = orgError.code === "23505" ? "An organization with that slug already exists." : orgError.message;
    return NextResponse.json({ error: message }, { status: orgError.code === "23505" ? 409 : 500 });
  }

  const { error: settingsError } = await supabase.from("company_settings").insert({ organization_id: org.id, financial_year_start_month: 4 });
  if (settingsError) {
    await supabase.from("organizations").delete().eq("id", org.id);
    return NextResponse.json({ error: settingsError.message }, { status: 500 });
  }
  await seedDefaultLeaveTypes(supabase, org.id);

  try {
    const { userId, tempPassword } = await createUserWithProfile({
      organizationId: org.id,
      email: String(adminEmail),
      fullName: String(adminFullName),
      phone: adminPhone ? String(adminPhone) : undefined,
      accountType: "admin",
    });
    return NextResponse.json({ ok: true, organization: org, adminUserId: userId, tempPassword }, { status: 201 });
  } catch (err) {
    await supabase.from("company_settings").delete().eq("organization_id", org.id);
    await supabase.from("organizations").delete().eq("id", org.id);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create admin account" }, { status: 500 });
  }
}
