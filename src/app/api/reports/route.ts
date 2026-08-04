import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";

function toCsvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(rows: string[][]) {
  return rows.map((row) => row.map(toCsvCell).join(",")).join("\n");
}

// GET /api/reports?type=attendance|salary|leave|employees|department&month=&year=
// Admin only. Every report exports as CSV (Excel-compatible) — matches
// the spec's "Export: Excel" requirement without needing a real .xlsx
// library, since CSV opens directly in Excel/Sheets.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const supabase = getSupabaseAdmin();

  if (type === "employees") {
    const { data } = await supabase
      .from("profiles")
      .select("employee_id, full_name, department, designation, date_of_joining, phone, city, state")
      .in("account_type", ["staff", "admin"]);
    const rows = [["Employee ID", "Name", "Department", "Designation", "Date of Joining", "Phone", "City", "State"]];
    for (const p of data ?? []) {
      rows.push([p.employee_id ?? "", p.full_name ?? "", p.department ?? "", p.designation ?? "", p.date_of_joining ?? "", p.phone ?? "", p.city ?? "", p.state ?? ""]);
    }
    return csvResponse(toCsv(rows), "employee-list.csv");
  }

  if (type === "department") {
    const { data } = await supabase
      .from("profiles")
      .select("department, full_name, designation")
      .in("account_type", ["staff", "admin"]);
    const byDept = new Map<string, { full_name: string | null; designation: string | null }[]>();
    for (const p of data ?? []) {
      const dept = p.department ?? "Unassigned";
      if (!byDept.has(dept)) byDept.set(dept, []);
      byDept.get(dept)!.push(p);
    }
    const rows = [["Department", "Employee", "Designation"]];
    for (const [dept, people] of byDept) {
      for (const person of people) rows.push([dept, person.full_name ?? "", person.designation ?? ""]);
    }
    return csvResponse(toCsv(rows), "department-wise-report.csv");
  }

  if (type === "leave") {
    const { data } = await supabase
      .from("leave_requests")
      .select("*, profiles!leave_requests_staff_id_fkey(full_name)")
      .order("created_at", { ascending: false });
    const rows = [["Employee", "Leave Type", "Start Date", "End Date", "Status", "Reason"]];
    for (const r of data ?? []) {
      rows.push([r.profiles?.full_name ?? "", r.leave_type, r.start_date, r.end_date, r.status, r.reason ?? ""]);
    }
    return csvResponse(toCsv(rows), "leave-report.csv");
  }

  if (type === "salary") {
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    let query = supabase
      .from("payslips")
      .select("*, profiles!payslips_staff_id_fkey(full_name)")
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    if (month) query = query.eq("month", Number(month));
    if (year) query = query.eq("year", Number(year));
    const { data } = await query;
    const rows = [["Employee", "Month", "Year", "Gross Salary", "PF", "ESI", "Professional Tax", "TDS", "Net Salary"]];
    for (const p of data ?? []) {
      rows.push([p.profiles?.full_name ?? "", String(p.month), String(p.year), String(p.gross_salary), String(p.pf_deduction), String(p.esi_deduction), String(p.professional_tax), String(p.tds), String(p.net_salary)]);
    }
    return csvResponse(toCsv(rows), "salary-report.csv");
  }

  if (type === "attendance") {
    const month = searchParams.get("month");
    let query = supabase
      .from("attendance_events")
      .select("*, profiles!attendance_events_staff_id_fkey(full_name)")
      .order("occurred_at", { ascending: true });
    if (month) {
      const [y, m] = month.split("-").map(Number);
      const start = `${month}-01`;
      const end = new Date(y, m, 1).toISOString().slice(0, 10);
      query = query.gte("occurred_at", start).lt("occurred_at", end);
    }
    const { data } = await query;
    const rows = [["Employee", "Date", "Event", "Time"]];
    for (const ev of data ?? []) {
      const d = new Date(ev.occurred_at);
      rows.push([ev.profiles?.full_name ?? "", d.toLocaleDateString("en-IN"), ev.event_type, d.toLocaleTimeString("en-IN")]);
    }
    return csvResponse(toCsv(rows), "attendance-report.csv");
  }

  return NextResponse.json({ error: "Unknown report type. Use attendance, salary, leave, employees, or department." }, { status: 400 });
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
