// GET /api/activity/sessions - Get user sessions (platform admin only)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile?.is_platform_admin && profile?.account_type !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createClient();
    const { searchParams } = new URL(req.url);
    
    const userId = searchParams.get("user_id");
    const orgId = searchParams.get("org_id");
    const isActive = searchParams.get("is_active");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("user_sessions")
      .select(`
        *,
        profiles!user_sessions_user_id_fkey (
          id,
          full_name,
          email,
          account_type
        )
      `)
      .order("session_start", { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) query = query.eq("user_id", userId);
    if (orgId) query = query.eq("organization_id", orgId);
    if (isActive === "true") query = query.eq("is_active", true);
    else if (isActive === "false") query = query.eq("is_active", false);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sessions: data });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
