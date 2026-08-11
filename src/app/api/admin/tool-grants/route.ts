import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { DELEGABLE_TOOLS, type ToolKey } from "@/lib/tool-grants";

const TOOL_KEYS = new Set<string>(DELEGABLE_TOOLS.map((t) => t.key));

// GET /api/admin/tool-grants — org admin only. Lists every staff member
// in the org (so the UI can show "not granted" rows too, not just
// existing grants) alongside whatever staff_tool_grants rows already
// exist for them.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const [{ data: staff, error: staffError }, { data: grants, error: grantsError }] = await Promise.all([
    supabase
      .from("profiles")
      // No email column on profiles (it lives in Supabase Auth, not
      // here — same reason getCurrentProfile() attaches it manually
      // from the session user rather than selecting it). Customer
      // accounts are deliberately excluded — every delegable tool
      // assumes its grantee is staff; a customer wanting real CRM
      // capability goes through Request CRM Access (their own org)
      // instead, not this delegation path.
      .select("id, full_name, account_type, staff_level")
      .eq("organization_id", profile.organization_id)
      .in("account_type", ["staff", "admin"])
      .order("full_name"),
    supabase.from("staff_tool_grants").select("*").eq("organization_id", profile.organization_id),
  ]);
  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 });
  if (grantsError) return NextResponse.json({ error: grantsError.message }, { status: 500 });

  return NextResponse.json({ staff, grants, tools: DELEGABLE_TOOLS });
}

// POST /api/admin/tool-grants — grant (or update) one staff member's
// access to one delegable tool. Upserts on (staff_id, tool_key) so
// re-granting just updates the expiry/granted_by instead of erroring on
// the unique constraint.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const staffId = typeof body?.staffId === "string" ? body.staffId : "";
  const toolKey = typeof body?.toolKey === "string" ? (body.toolKey as ToolKey) : "";
  const expiresAt = typeof body?.expiresAt === "string" && body.expiresAt ? body.expiresAt : null;
  if (!staffId || !TOOL_KEYS.has(toolKey)) {
    return NextResponse.json({ error: "staffId and a valid toolKey are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: target } = await supabase.from("profiles").select("organization_id, account_type").eq("id", staffId).maybeSingle();
  if (!target || target.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Not a staff member in your organization" }, { status: 400 });
  }
  if (target.account_type !== "staff") {
    return NextResponse.json({ error: "Only staff accounts can be delegated a tool (admins already have full access; a customer should use Request CRM Access for their own workspace instead)" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("staff_tool_grants")
    .upsert(
      { organization_id: profile.organization_id, staff_id: staffId, tool_key: toolKey, granted_by: profile.id, expires_at: expiresAt },
      { onConflict: "staff_id,tool_key" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, grant: data }, { status: 201 });
}
