import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";

// PATCH /api/admin/email-failures/[id] — admin only. Marks a failure as
// resolved once staff has followed up manually (called the customer,
// resent via another channel, etc.) — there's no automated retry here.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "email_failures"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  let query = supabase.from("email_failures").update({ resolved: true, resolved_by: profile.id }).eq("id", id);
  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  const { data, error } = await query.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, failure: data });
}
