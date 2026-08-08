import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";

function toCsvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Leading "#" row-number column on every export from this route — rows[0]
// is always the header row (every call site below builds it that way),
// so it gets "#" prepended while every following data row gets its
// 1-based position instead.
function toCsv(rows: string[][]) {
  const [header, ...data] = rows;
  const numbered = [["#", ...header], ...data.map((row, i) => [String(i + 1), ...row])];
  return numbered.map((row) => row.map(toCsvCell).join(",")).join("\n");
}

// GET /api/reports?type=attendance|salary|leave|employees|department&month=&year=
// Admin only. Every report exports as CSV (Excel-compatible) — matches
// the spec's "Export: Excel" requirement without needing a real .xlsx
// library, since CSV opens directly in Excel/Sheets.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !(await hasToolAccess(profile, "reports"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const supabase = getSupabaseAdmin();

  const orgScoped = !canSeeAllOrgs(profile);

  if (type === "employees") {
    // organizations(name) only actually matters for a platform_admin
    // export, which pools every org's employees together — without an
    // Organization column, two orgs' employees are indistinguishable
    // in the CSV.
    let empQuery = supabase
      .from("profiles")
      .select("employee_id, full_name, department, designation, date_of_joining, phone, city, state, organizations(name)")
      .in("account_type", ["staff", "admin"]);
    if (orgScoped) empQuery = empQuery.eq("organization_id", profile.organization_id);
    const { data } = await empQuery;
    const rows = [[
      "Employee ID", "Name", "Department", "Designation", "Date of Joining", "Phone", "City", "State",
      ...(orgScoped ? [] : ["Organization"]),
    ]];
    for (const p of (data ?? []) as unknown as { employee_id: string | null; full_name: string | null; department: string | null; designation: string | null; date_of_joining: string | null; phone: string | null; city: string | null; state: string | null; organizations: { name: string | null } | null }[]) {
      rows.push([
        p.employee_id ?? "", p.full_name ?? "", p.department ?? "", p.designation ?? "", p.date_of_joining ?? "", p.phone ?? "", p.city ?? "", p.state ?? "",
        ...(orgScoped ? [] : [p.organizations?.name ?? "Unknown organization"]),
      ]);
    }
    return csvResponse(toCsv(rows), "employee-list.csv");
  }

  if (type === "department") {
    // Grouping by department name alone would merge two different
    // orgs' identically-named departments (e.g. "Operations") into one
    // group in a platform_admin's pooled export — group by org+name
    // instead, and add an Organization column so the CSV doesn't imply
    // rows belong to the same department when they don't.
    let deptQuery = supabase
      .from("profiles")
      .select("department, full_name, designation, organization_id, organizations(name)")
      .in("account_type", ["staff", "admin"]);
    if (orgScoped) deptQuery = deptQuery.eq("organization_id", profile.organization_id);
    const { data } = await deptQuery;
    type DeptPerson = { full_name: string | null; designation: string | null; organizationName: string };
    const byDept = new Map<string, DeptPerson[]>();
    for (const p of (data ?? []) as unknown as { department: string | null; full_name: string | null; designation: string | null; organization_id: string; organizations: { name: string | null } | null }[]) {
      const dept = p.department ?? "Unassigned";
      const orgName = p.organizations?.name ?? "Unknown organization";
      const groupKey = orgScoped ? dept : `${p.organization_id}::${dept}`;
      if (!byDept.has(groupKey)) byDept.set(groupKey, []);
      byDept.get(groupKey)!.push({ full_name: p.full_name, designation: p.designation, organizationName: orgName });
    }
    const rows = [["Department", "Employee", "Designation", ...(orgScoped ? [] : ["Organization"])]];
    for (const [groupKey, people] of byDept) {
      const dept = orgScoped ? groupKey : groupKey.split("::")[1];
      for (const person of people) {
        rows.push([dept, person.full_name ?? "", person.designation ?? "", ...(orgScoped ? [] : [person.organizationName])]);
      }
    }
    return csvResponse(toCsv(rows), "department-wise-report.csv");
  }

  if (type === "leave") {
    // organizations(name) only actually matters for a platform_admin
    // export, which pools every org's leave requests together — a name
    // collision across orgs would otherwise be indistinguishable.
    let leaveQuery = supabase
      .from("leave_requests")
      .select("*, profiles!leave_requests_staff_id_fkey(full_name), organizations(name)")
      .order("created_at", { ascending: false });
    if (orgScoped) leaveQuery = leaveQuery.eq("organization_id", profile.organization_id);
    const { data } = await leaveQuery;
    const rows = [["Employee", "Leave Type", "Start Date", "End Date", "Status", "Reason", ...(orgScoped ? [] : ["Organization"])]];
    for (const r of (data ?? []) as unknown as { profiles: { full_name: string | null } | null; leave_type: string; start_date: string; end_date: string; status: string; reason: string | null; organizations: { name: string | null } | null }[]) {
      rows.push([
        r.profiles?.full_name ?? "", r.leave_type, r.start_date, r.end_date, r.status, r.reason ?? "",
        ...(orgScoped ? [] : [r.organizations?.name ?? "Unknown organization"]),
      ]);
    }
    return csvResponse(toCsv(rows), "leave-report.csv");
  }

  if (type === "salary") {
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    // organizations(name) only actually matters for a platform_admin
    // export, which pools every org's payslips together.
    let query = supabase
      .from("payslips")
      .select("*, profiles!payslips_staff_id_fkey(full_name), organizations(name)")
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    if (month) query = query.eq("month", Number(month));
    if (year) query = query.eq("year", Number(year));
    if (orgScoped) query = query.eq("organization_id", profile.organization_id);
    const { data } = await query;
    const rows = [["Employee", "Month", "Year", "Gross Salary", "PF", "ESI", "Professional Tax", "TDS", "Net Salary", ...(orgScoped ? [] : ["Organization"])]];
    for (const p of (data ?? []) as unknown as { profiles: { full_name: string | null } | null; month: number; year: number; gross_salary: number; pf_deduction: number; esi_deduction: number; professional_tax: number; tds: number; net_salary: number; organizations: { name: string | null } | null }[]) {
      rows.push([
        p.profiles?.full_name ?? "", String(p.month), String(p.year), String(p.gross_salary), String(p.pf_deduction), String(p.esi_deduction), String(p.professional_tax), String(p.tds), String(p.net_salary),
        ...(orgScoped ? [] : [p.organizations?.name ?? "Unknown organization"]),
      ]);
    }
    return csvResponse(toCsv(rows), "salary-report.csv");
  }

  if (type === "attendance") {
    const month = searchParams.get("month");
    // organizations(name) only actually matters for a platform_admin
    // export, which pools every org's attendance events together.
    let query = supabase
      .from("attendance_events")
      .select("*, profiles!attendance_events_staff_id_fkey(full_name), organizations(name)")
      .order("occurred_at", { ascending: true });
    if (month) {
      const [y, m] = month.split("-").map(Number);
      const start = `${month}-01`;
      const end = new Date(y, m, 1).toISOString().slice(0, 10);
      query = query.gte("occurred_at", start).lt("occurred_at", end);
    }
    if (orgScoped) query = query.eq("organization_id", profile.organization_id);
    const { data } = await query;
    const rows = [["Employee", "Date", "Event", "Time", ...(orgScoped ? [] : ["Organization"])]];
    for (const ev of (data ?? []) as unknown as { profiles: { full_name: string | null } | null; occurred_at: string; event_type: string; organizations: { name: string | null } | null }[]) {
      const d = new Date(ev.occurred_at);
      rows.push([
        ev.profiles?.full_name ?? "", d.toLocaleDateString("en-IN"), ev.event_type, d.toLocaleTimeString("en-IN"),
        ...(orgScoped ? [] : [ev.organizations?.name ?? "Unknown organization"]),
      ]);
    }
    return csvResponse(toCsv(rows), "attendance-report.csv");
  }

  if (type === "invoice-ageing") {
    let ageingQuery = supabase
      .from("invoices")
      .select("invoice_number, total, due_at, status, profiles!invoices_customer_id_fkey(full_name), invoice_payments(amount)")
      .not("status", "in", "(paid,cancelled,draft)")
      .order("due_at", { ascending: true });
    if (orgScoped) ageingQuery = ageingQuery.eq("organization_id", profile.organization_id);
    const { data } = await ageingQuery;

    const rows = [["Invoice", "Customer", "Total", "Paid", "Balance", "Due Date", "Days Overdue", "Bucket"]];
    const now = Date.now();
    for (const inv of (data ?? []) as unknown as {
      invoice_number: string;
      total: number;
      due_at: string | null;
      profiles: { full_name: string | null } | null;
      invoice_payments: { amount: number }[];
    }[]) {
      const paid = (inv.invoice_payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
      const balance = Number(inv.total) - paid;
      if (balance <= 0) continue;
      const daysOverdue = inv.due_at ? Math.max(0, Math.floor((now - new Date(inv.due_at).getTime()) / 86400000)) : 0;
      const bucket = daysOverdue > 90 ? "90+" : daysOverdue > 60 ? "60-90" : daysOverdue > 30 ? "30-60" : daysOverdue > 0 ? "1-30" : "Not yet due";
      rows.push([
        inv.invoice_number,
        inv.profiles?.full_name ?? "",
        String(inv.total),
        String(paid),
        String(balance),
        inv.due_at ? new Date(inv.due_at).toLocaleDateString("en-IN") : "",
        String(daysOverdue),
        bucket,
      ]);
    }
    return csvResponse(toCsv(rows), "invoice-ageing-report.csv");
  }

  return NextResponse.json({ error: "Unknown report type. Use attendance, salary, leave, employees, department, or invoice-ageing." }, { status: 400 });
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
