// POST /api/activity/log - Log user activity from client
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { logActivityServer, type ActivityLog } from "@/lib/activity-logger";

export async function POST(req: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const log: ActivityLog = await req.json();

    // Get IP address from request headers
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || 
               req.headers.get("x-real-ip") || 
               "unknown";

    // Get session ID from cookies if available
    // You can store this in a cookie when user logs in
    const sessionId = req.cookies.get("session_id")?.value || null;

    await logActivityServer(
      profile.id,
      profile.organization_id,
      log,
      sessionId,
      ip
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Activity logging error:", error);
    // Return success even on error - we don't want to break user experience
    return NextResponse.json({ success: true });
  }
}
