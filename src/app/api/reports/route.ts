import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";
import { countWorkingDays } from "@/lib/working-days";

// Reports render timestamps for an Indian business regardless of where
// the server runs.
const IST_TZ = "Asia/Kolkata";

// Types that represent real money owed. Mirrors invoiceBalanceSign() === 1
// in src/lib/invoice-calc.ts; kept as a literal because PostgREST needs
// concrete values in an .in() filter.
const COLLECTABLE_INVOICE_TYPES = ["gst", "non_gst", "export", "debit_note"];

// Legacy rows predate configurable leave types and carry only the enum.
const LEAVE_TYPE_FALLBACK: Record<string, string> = {
  sick: "Sick Leave", casual: "Casual Leave", paid: "Paid Leave", unpaid: "Unpaid Leave",
};

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

// GET /api/reports?type=attendance|salary|leave|employees|department&month=&year=&from=&to=
// attendance additionally accepts from=/to= (YYYY-MM-DD), which takes
// priority over month= when present — a day-level range instead of a
// whole-calendar-month one.
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
    // organizations!organization_id disambiguates the embed — profiles
    // has more than one FK to organizations now.
    let empQuery = supabase
      .from("profiles")
      .select("employee_id, full_name, department, designation, date_of_joining, phone, city, state, is_active, organizations!organization_id(name)")
      .in("account_type", ["staff", "admin"]);
    if (orgScoped) empQuery = empQuery.eq("organization_id", profile.organization_id);
    const { data } = await empQuery;
    // Status column: deactivated employees are deliberately still
    // exported (their history is real and headcount reconciliation needs
    // them), but they were indistinguishable from current staff, so the
    // list read as a larger active headcount than the business has.
    const rows = [[
      "Employee ID", "Name", "Department", "Designation", "Date of Joining", "Phone", "City", "State", "Status",
      ...(orgScoped ? [] : ["Organization"]),
    ]];
    for (const p of (data ?? []) as unknown as { employee_id: string | null; full_name: string | null; department: string | null; designation: string | null; date_of_joining: string | null; phone: string | null; city: string | null; state: string | null; is_active: boolean | null; organizations: { name: string | null } | null }[]) {
      rows.push([
        p.employee_id ?? "", p.full_name ?? "", p.department ?? "", p.designation ?? "", p.date_of_joining ?? "", p.phone ?? "", p.city ?? "", p.state ?? "",
        p.is_active === false ? "Deactivated" : "Active",
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
      .select("department, full_name, designation, organization_id, organizations!organization_id(name)")
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
    // leave_types joined so the register shows the org's own configured
    // name ("Casual Leave") rather than the internal enum ("paid"),
    // which is what it printed before and means nothing to a reader.
    let leaveQuery = supabase
      .from("leave_requests")
      .select("*, profiles!leave_requests_staff_id_fkey(full_name), leave_types(name), organizations(name)")
      .order("created_at", { ascending: false });
    if (orgScoped) leaveQuery = leaveQuery.eq("organization_id", profile.organization_id);
    const { data } = await leaveQuery;

    // Holidays for every org in the export, so Days can be measured the
    // same way the balance was actually charged — working days only,
    // excluding weekends and that org's own holidays.
    const leaveOrgIds = Array.from(new Set((data ?? []).map((r) => (r as { organization_id: string }).organization_id)));
    const { data: leaveHolidays } = leaveOrgIds.length
      ? await supabase.from("holidays").select("organization_id, date").in("organization_id", leaveOrgIds)
      : { data: [] as { organization_id: string; date: string }[] };
    const holidaysByOrgForLeave = new Map<string, Set<string>>();
    for (const h of leaveHolidays ?? []) {
      if (!holidaysByOrgForLeave.has(h.organization_id)) holidaysByOrgForLeave.set(h.organization_id, new Set());
      holidaysByOrgForLeave.get(h.organization_id)!.add(String(h.date).slice(0, 10));
    }

    // Days is the number the whole register exists to report and it
    // wasn't there at all — a reader had to subtract two dates by hand,
    // and would have got it wrong anyway, since leave is charged in
    // working days and a half-day counts as 0.5.
    const rows = [["Employee", "Leave Type", "Start Date", "End Date", "Days", "Status", "Reason", ...(orgScoped ? [] : ["Organization"])]];
    for (const r of (data ?? []) as unknown as { profiles: { full_name: string | null } | null; leave_type: string; leave_types: { name: string } | null; day_fraction: number | string | null; organization_id: string; start_date: string; end_date: string; status: string; reason: string | null; organizations: { name: string | null } | null }[]) {
      const days =
        countWorkingDays(r.start_date, r.end_date, holidaysByOrgForLeave.get(r.organization_id) ?? new Set()) *
        Number(r.day_fraction ?? 1);
      rows.push([
        r.profiles?.full_name ?? "",
        r.leave_types?.name ?? LEAVE_TYPE_FALLBACK[r.leave_type] ?? r.leave_type,
        r.start_date,
        r.end_date,
        String(days),
        r.status,
        r.reason ?? "",
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
    // LOP days and the Loss of Pay amount are columns, not omissions:
    // net = gross - PF - ESI - PT - TDS - LOP, so leaving LOP out made
    // the register fail to add up the moment anyone had an absence, with
    // nothing on the row to explain the gap.
    const rows = [["Employee", "Month", "Year", "Gross Salary", "LOP Days", "Loss of Pay", "PF", "ESI", "Professional Tax", "TDS", "Net Salary", ...(orgScoped ? [] : ["Organization"])]];
    for (const p of (data ?? []) as unknown as { profiles: { full_name: string | null } | null; month: number; year: number; gross_salary: number; lop_days: number | null; lop_deduction: number | null; pf_deduction: number; esi_deduction: number; professional_tax: number; tds: number; net_salary: number; organizations: { name: string | null } | null }[]) {
      rows.push([
        p.profiles?.full_name ?? "", String(p.month), String(p.year), String(p.gross_salary), String(p.lop_days ?? 0), String(p.lop_deduction ?? 0), String(p.pf_deduction), String(p.esi_deduction), String(p.professional_tax), String(p.tds), String(p.net_salary),
        ...(orgScoped ? [] : [p.organizations?.name ?? "Unknown organization"]),
      ]);
    }
    return csvResponse(toCsv(rows), "salary-report.csv");
  }

  if (type === "attendance") {
    const month = searchParams.get("month");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    // organizations(name) only actually matters for a platform_admin
    // export, which pools every org's attendance events together.
    let query = supabase
      .from("attendance_events")
      .select("*, profiles!attendance_events_staff_id_fkey(full_name), organizations(name)")
      .order("occurred_at", { ascending: true });
    // Custom day-level range (from/to) takes priority over month — the
    // Data Exports page only ever sends one or the other, never both,
    // but from/to is the more specific request when it's there.
    if (from || to) {
      if (from) query = query.gte("occurred_at", from);
      if (to) {
        // Exclusive upper bound one day past `to` so the end date's own
        // events (any time from 00:00 to 23:59:59 that day) are included
        // — a plain .lte("occurred_at", to) would compare a timestamp
        // against a bare date and silently drop everything after
        // midnight on the end date itself.
        const end = new Date(`${to}T00:00:00Z`);
        end.setUTCDate(end.getUTCDate() + 1);
        query = query.lt("occurred_at", end.toISOString().slice(0, 10));
      }
    } else if (month) {
      const [y, m] = month.split("-").map(Number);
      const start = `${month}-01`;
      // Date.UTC, not new Date(y, m, ...) — the latter is local time and
  // toISOString() converts it back to UTC, which lands a day earlier for
  // any timezone ahead of UTC. As an exclusive month-end bound in IST
  // that silently dropped the last day of every month from the range.
      const end = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
      query = query.gte("occurred_at", start).lt("occurred_at", end);
    }
    if (orgScoped) query = query.eq("organization_id", profile.organization_id);
    const { data } = await query;
    const rows = [["Employee", "Date", "Event", "Time", ...(orgScoped ? [] : ["Organization"])]];
    for (const ev of (data ?? []) as unknown as { profiles: { full_name: string | null } | null; occurred_at: string; event_type: string; organizations: { name: string | null } | null }[]) {
      const d = new Date(ev.occurred_at);
      // timeZone is explicit because a locale only controls FORMAT, not
      // zone: on a UTC server "en-IN" rendered every punch in UTC, so a
      // 1:30 AM IST check-in exported as the previous day at 8:00 PM —
      // wrong date and 5h30m off, on every row of the register.
      rows.push([
        ev.profiles?.full_name ?? "",
        d.toLocaleDateString("en-IN", { timeZone: IST_TZ }),
        ev.event_type,
        d.toLocaleTimeString("en-IN", { timeZone: IST_TZ }),
        ...(orgScoped ? [] : [ev.organizations?.name ?? "Unknown organization"]),
      ]);
    }
    return csvResponse(toCsv(rows), "attendance-report.csv");
  }

  if (type === "invoice-ageing") {
    // Filtered by TYPE as well as status. An ageing report is the
    // accounts-receivable document — a credit note is money the business
    // owes the CUSTOMER and a proforma is a quotation, so listing either
    // as an outstanding balance overstates receivables. Status alone
    // didn't exclude them: a credit note sits in 'sent' like any other.
    let ageingQuery = supabase
      .from("invoices")
      .select("invoice_number, total, due_at, status, invoice_type, profiles!invoices_customer_id_fkey(full_name), invoice_payments(amount), organizations(name)")
      .not("status", "in", "(paid,cancelled,draft)")
      .in("invoice_type", COLLECTABLE_INVOICE_TYPES)
      .order("due_at", { ascending: true });
    if (orgScoped) ageingQuery = ageingQuery.eq("organization_id", profile.organization_id);
    const { data } = await ageingQuery;

    // Organization column, same as every other report here — a
    // platform_admin export pools every tenant's receivables together
    // and this was the one report with no way to tell them apart.
    const rows = [["Invoice", "Customer", "Total", "Paid", "Balance", "Due Date", "Days Overdue", "Bucket", ...(orgScoped ? [] : ["Organization"])]];
    const now = Date.now();
    for (const inv of (data ?? []) as unknown as {
      invoice_number: string;
      total: number;
      due_at: string | null;
      profiles: { full_name: string | null } | null;
      invoice_payments: { amount: number }[];
      organizations: { name: string | null } | null;
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
        inv.due_at ? new Date(inv.due_at).toLocaleDateString("en-IN", { timeZone: IST_TZ }) : "",
        String(daysOverdue),
        bucket,
        ...(orgScoped ? [] : [inv.organizations?.name ?? "Unknown organization"]),
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
