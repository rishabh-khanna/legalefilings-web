// GET /api/activity/stats - Get activity statistics (platform admin only)
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
    
    const orgId = searchParams.get("org_id");
    const days = parseInt(searchParams.get("days") || "30");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build base query with org filter if provided
    const orgFilter = orgId ? { organization_id: orgId } : {};

    // Get total users who had activity
    const { count: activeUsers } = await supabase
      .from("activity_logs")
      .select("user_id", { count: "exact", head: true })
      .gte("created_at", startDate.toISOString())
      .match(orgFilter);

    // Get total sessions
    const { count: totalSessions } = await supabase
      .from("user_sessions")
      .select("*", { count: "exact", head: true })
      .gte("session_start", startDate.toISOString())
      .match(orgFilter);

    // Get active sessions
    const { count: activeSessions } = await supabase
      .from("user_sessions")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .match(orgFilter);

    // Get total activities
    const { count: totalActivities } = await supabase
      .from("activity_logs")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startDate.toISOString())
      .match(orgFilter);

    // Get activity by category
    const { data: categoryBreakdown } = await supabase
      .from("activity_logs")
      .select("category")
      .gte("created_at", startDate.toISOString())
      .match(orgFilter);

    const categoryCounts = categoryBreakdown?.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Get daily active users
    const { data: dailyActiveUsersData } = await supabase
      .from("daily_active_users")
      .select("*")
      .gte("activity_date", startDate.toISOString().split("T")[0])
      .match(orgFilter ? { organization_id: orgId } : {})
      .order("activity_date", { ascending: true });

    // Get popular pages
    const { data: popularPages } = await supabase
      .from("popular_pages")
      .select("*")
      .match(orgFilter)
      .limit(10);

    // Get recent logins
    const { data: recentLogins } = await supabase
      .from("login_history")
      .select("*")
      .match(orgFilter)
      .order("login_time", { ascending: false })
      .limit(20);

    return NextResponse.json({
      stats: {
        activeUsers: activeUsers || 0,
        totalSessions: totalSessions || 0,
        activeSessions: activeSessions || 0,
        totalActivities: totalActivities || 0,
        categoryBreakdown: categoryCounts,
      },
      dailyActiveUsers: dailyActiveUsersData || [],
      popularPages: popularPages || [],
      recentLogins: recentLogins || [],
    });
  } catch (error) {
    console.error("Error fetching activity stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
