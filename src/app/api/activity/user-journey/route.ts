// GET /api/activity/user-journey - Get user journey timeline (platform admin only)
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile?.is_platform_admin && profile?.account_type !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    
    const userId = searchParams.get("user_id");
    const sessionId = searchParams.get("session_id");
    
    if (!userId && !sessionId) {
      return NextResponse.json(
        { error: "Either user_id or session_id is required" },
        { status: 400 }
      );
    }
    
    let query = supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: true });

    if (sessionId) {
      query = query.eq("session_id", sessionId);
    } else if (userId) {
      query = query.eq("user_id", userId);
      
      // Optional: limit to recent activity if no session specified
      const days = parseInt(searchParams.get("days") || "7");
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      query = query.gte("created_at", startDate.toISOString());
    }

    const { data: activities, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group activities into sessions if user_id query
    if (userId && !sessionId) {
      const sessions = (activities as any[])?.reduce((acc: any, activity: any) => {
        const sid = activity.session_id || "no-session";
        if (!acc[sid]) {
          acc[sid] = [];
        }
        acc[sid].push(activity);
        return acc;
      }, {} as Record<string, any[]>) || {};

      return NextResponse.json({
        journey: Object.entries(sessions).map(([sessionId, acts]) => {
          const activityList = acts as any[];
          return {
            sessionId: sessionId === "no-session" ? null : sessionId,
            activities: activityList,
            startTime: activityList[0]?.created_at,
            endTime: activityList[activityList.length - 1]?.created_at,
            activityCount: activityList.length,
          };
        }),
      });
    }

    // Single session journey
    return NextResponse.json({
      journey: activities || [],
      startTime: activities?.[0]?.created_at,
      endTime: activities?.[activities.length - 1]?.created_at,
      activityCount: activities?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching user journey:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
