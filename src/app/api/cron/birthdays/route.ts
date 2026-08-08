import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { sendBirthdayEmail } from "@/lib/email";

// GET /api/cron/birthdays — triggered daily by Vercel Cron (see
// vercel.json). Finds every profile (customer, staff, or admin — one
// shared table, across every organization) whose date_of_birth matches
// today's month/day and sends them a birthday email.
//
// Fails CLOSED, not open: this used to skip the secret check entirely
// whenever CRON_SECRET was unset, which would make a platform-wide,
// cross-org bulk-email trigger fully public. Same fallback pattern as
// /api/recurring-invoices/run — no valid cron secret means it now
// requires a real platform_admin session instead of nothing at all.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const profile = await getCurrentProfile();
    if (!profile?.is_platform_admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, date_of_birth, organization_id, organizations(name)");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // UTC, not server-local time — Vercel Cron fires on a UTC schedule (see
  // vercel.json), so "today" here has to mean the same thing the schedule
  // means, regardless of what timezone the process happens to be running in.
  const today = new Date();
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();

  const birthdayProfiles = (profiles ?? []).filter((p) => {
    if (!p.date_of_birth) return false;
    const [, m, d] = p.date_of_birth.split("-").map(Number);
    return m === month && d === day;
  });

  const results: { id: string; ok: boolean }[] = [];
  for (const profile of birthdayProfiles) {
    // Need the email address, which lives on auth.users, not profiles.
    const { data: authUser } = await supabase.auth.admin.getUserById(profile.id);
    const email = authUser?.user?.email;
    if (!email || !profile.full_name) {
      results.push({ id: profile.id, ok: false });
      continue;
    }
    try {
      const orgName = (profile.organizations as unknown as { name: string } | null)?.name;
      await sendBirthdayEmail({ name: profile.full_name, email, orgName });
      results.push({ id: profile.id, ok: true });
    } catch (err) {
      console.error(`Failed to send birthday email to ${profile.id}:`, err);
      results.push({ id: profile.id, ok: false });
    }
  }

  return NextResponse.json({ checked: profiles?.length ?? 0, birthdaysToday: birthdayProfiles.length, results });
}
