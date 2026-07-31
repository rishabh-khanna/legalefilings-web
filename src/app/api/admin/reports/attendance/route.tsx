import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { SITE_NAME } from "@/config/site";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  brand: { fontSize: 18, fontWeight: 700, color: "#0f172a" },
  muted: { color: "#5b6b81" },
  summaryRow: { flexDirection: "row", gap: 24, marginBottom: 20 },
  summaryBox: { flex: 1, padding: 10, backgroundColor: "#f6f8fb", borderRadius: 8 },
  summaryLabel: { fontSize: 8, textTransform: "uppercase", color: "#5b6b81", marginBottom: 2 },
  summaryValue: { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  table: { marginTop: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e8ecf2", paddingVertical: 6 },
  thText: { fontSize: 9, fontWeight: 700, color: "#0f172a" },
  tdText: { fontSize: 9, color: "#334155" },
  col: { flex: 1 },
});

function AttendanceReportPdf({
  staffName,
  month,
  rows,
  totalDays,
  totalHours,
}: {
  staffName: string;
  month: string;
  rows: { date: string; checkIn: string; checkOut: string; hours: string }[];
  totalDays: number;
  totalHours: string;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{SITE_NAME}</Text>
            <Text style={styles.muted}>Attendance Report</Text>
          </View>
          <View>
            <Text style={{ fontSize: 14, fontWeight: 700 }}>{staffName}</Text>
            <Text style={styles.muted}>{month}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Days Present</Text>
            <Text style={styles.summaryValue}>{totalDays}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Total Hours</Text>
            <Text style={styles.summaryValue}>{totalHours}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.thText, styles.col]}>Date</Text>
            <Text style={[styles.thText, styles.col]}>Check In</Text>
            <Text style={[styles.thText, styles.col]}>Check Out</Text>
            <Text style={[styles.thText, styles.col]}>Hours</Text>
          </View>
          {rows.map((row, i) => (
            <View style={styles.tr} key={i}>
              <Text style={[styles.tdText, styles.col]}>{row.date}</Text>
              <Text style={[styles.tdText, styles.col]}>{row.checkIn}</Text>
              <Text style={[styles.tdText, styles.col]}>{row.checkOut}</Text>
              <Text style={[styles.tdText, styles.col]}>{row.hours}</Text>
            </View>
          ))}
          {rows.length === 0 && (
            <View style={styles.tr}>
              <Text style={styles.tdText}>No attendance recorded this month.</Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}

// GET /api/admin/reports/attendance?staffId=...&month=YYYY-MM — admin-only
// PDF export: one row per day with check-in, check-out, and total hours.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get("staffId");
  const month = searchParams.get("month");
  if (!staffId || !month) return NextResponse.json({ error: "staffId and month are required" }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data: staffProfile } = await supabase.from("profiles").select("full_name").eq("id", staffId).single();

  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const end = new Date(y, m, 1).toISOString().slice(0, 10);

  const { data: events, error } = await supabase
    .from("attendance_events")
    .select("*")
    .eq("staff_id", staffId)
    .gte("occurred_at", start)
    .lt("occurred_at", end)
    .order("occurred_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byDay = new Map<string, { checkIn?: string; checkOut?: string }>();
  for (const ev of events ?? []) {
    const day = ev.occurred_at.slice(0, 10);
    const entry = byDay.get(day) ?? {};
    if (ev.event_type === "check_in" && !entry.checkIn) entry.checkIn = ev.occurred_at;
    if (ev.event_type === "check_out") entry.checkOut = ev.occurred_at;
    byDay.set(day, entry);
  }

  let totalHoursNum = 0;
  const rows = Array.from(byDay.entries())
    .sort()
    .map(([day, entry]) => {
      const hoursNum = entry.checkIn && entry.checkOut
        ? (new Date(entry.checkOut).getTime() - new Date(entry.checkIn).getTime()) / 3600000
        : 0;
      totalHoursNum += hoursNum;
      return {
        date: day,
        checkIn: entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString("en-IN") : "—",
        checkOut: entry.checkOut ? new Date(entry.checkOut).toLocaleTimeString("en-IN") : "—",
        hours: hoursNum ? hoursNum.toFixed(2) : "—",
      };
    });

  const staffName = staffProfile?.full_name ?? "Staff";
  const monthLabel = new Date(`${month}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const buffer = await renderToBuffer(
    <AttendanceReportPdf staffName={staffName} month={monthLabel} rows={rows} totalDays={rows.length} totalHours={totalHoursNum.toFixed(2)} />
  );

  const filename = `attendance-${staffName.replace(/\s+/g, "_")}-${month}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
