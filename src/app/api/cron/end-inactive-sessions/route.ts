// Cron job to end inactive sessions
// Runs every hour to mark sessions as inactive if no activity for 60+ minutes
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient();

    // Call the database function to end inactive sessions (60 minutes)
    const { data, error } = await supabase.rpc("end_inactive_sessions", {
      inactive_minutes: 60,
    });

    if (error) {
      console.error("Error ending inactive sessions:", error);
      return NextResponse.json(
        { error: error.message, affectedCount: 0 },
        { status: 500 }
      );
    }

    console.log(`Ended ${data} inactive sessions`);

    return NextResponse.json({
      success: true,
      affectedCount: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
