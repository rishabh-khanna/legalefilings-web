import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";
import { AnimatedCounter } from "@/components/crm/AnimatedCounter";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { GettingStartedChecklist } from "@/components/crm/GettingStartedChecklist";
import { getMissingBusinessSettingsFields } from "@/lib/business-settings-completeness";

const PersonIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 20c.7-3.6 3-5.5 5.5-5.5s4.8 1.9 5.5 5.5" strokeLinecap="round" />
  </svg>
);
const InvoiceIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M6 3.5h9l3 3V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5Z" strokeLinejoin="round" />
    <path d="M9 9h6M9 12.5h6M9 16h4" strokeLinecap="round" />
  </svg>
);
const OrderIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75">
    <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5Z" strokeLinejoin="round" />
  </svg>
);

export default async function DashboardOverviewPage() {
  const profile = await getCurrentProfile();
  const supabase = getSupabaseAdmin();
  const staff = profile ? isStaffOrAdmin(profile) : false;
  const isAdminUser = profile?.account_type === "admin";

  // Scoped identically to the pages these stat cards link to
  // (/dashboard/orders, /dashboard/invoices via /api/invoices) — a rater
  // should see the same count here as when they click through, not a
  // company-wide total from a blanket "any staff can read all rows" RLS
  // policy. Orders scope by assigned_to; invoices scope by created_by —
  // matching each table's own canonical page.
  let ordersQuery = supabase.from("orders").select("id, service, status, created_at").order("created_at", { ascending: false });
  let invoicesQuery = supabase.from("invoices").select("id, invoice_number, total, status, created_at").order("created_at", { ascending: false });
  let leadsQuery = supabase.from("leads").select("id", { count: "exact", head: true }).eq("assigned_to", profile?.full_name ?? "");
  if (profile && !staff) {
    ordersQuery = ordersQuery.eq("customer_id", profile.id);
    invoicesQuery = invoicesQuery.eq("customer_id", profile.id);
  } else if (profile && staff) {
    if (!canSeeAllOrgs(profile)) {
      ordersQuery = ordersQuery.eq("organization_id", profile.organization_id);
      invoicesQuery = invoicesQuery.eq("organization_id", profile.organization_id);
      leadsQuery = leadsQuery.eq("organization_id", profile.organization_id);
    }
    // canSeeAllOrgs (is_platform_admin) must also skip the reporting-chain
    // narrowing below — independent axis from account_type, so a
    // platform_admin without account_type "admin" would otherwise pass
    // the org filter above (every org) and then get wrongly narrowed
    // straight back down to their own chain here.
    if (!isAdminUser && !canSeeAllOrgs(profile)) {
      const chain = await getReportingChainIds(profile.id);
      ordersQuery = ordersQuery.in("assigned_to", [profile.id, ...chain]);
      invoicesQuery = invoicesQuery.in("created_by", [profile.id, ...chain]);
    }
  }

  const [{ data: orders }, { data: invoices }, leadsCount] = await Promise.all([
    ordersQuery,
    invoicesQuery,
    staff && profile ? leadsQuery : Promise.resolve({ count: 0 }),
  ]);

  const orderList = orders ?? [];
  const invoiceList = invoices ?? [];
  const activeOrders = orderList.filter((o) => !["completed", "cancelled"].includes(o.status)).length;
  const pendingInvoices = invoiceList.filter((i) => i.status !== "paid").length;

  const isAdmin = profile?.account_type === "admin";
  let hrOverview: { totalEmployees: number; presentToday: number; absentToday: number; birthdaysToday: number; payrollDue: number } | null = null;
  let recentAttendance: { id: string; staffId: string; name: string; eventType: string; occurredAt: string }[] = [];
  let recentLeaveRequests: { id: string; name: string; leaveType: string; status: string; startDate: string; endDate: string }[] = [];
  let gettingStarted: { businessSettingsDone: boolean; hasTeamMembers: boolean; hasDepartments: boolean } | null = null;

  if (isAdmin) {
    const admin = getSupabaseAdmin();
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // profile is guaranteed here (isAdmin implies it), and platform_admin
    // gets literally every org's HR data on their own overview — the
    // rest of an org's own admin only ever sees their own org's.
    const orgScope = canSeeAllOrgs(profile!) ? null : profile!.organization_id;

    let totalEmployeesQuery = admin.from("profiles").select("id", { count: "exact", head: true }).in("account_type", ["staff", "admin"]);
    let checkinsQuery = admin.from("attendance_events").select("staff_id").eq("event_type", "check_in").gte("occurred_at", todayStart.toISOString());
    let birthdaysQuery = admin.from("profiles").select("date_of_birth").in("account_type", ["staff", "admin"]);
    let payslipsQuery = admin.from("payslips").select("id", { count: "exact", head: true }).eq("month", month).eq("year", year);
    let attendanceRowsQuery = admin
      .from("attendance_events")
      .select("id, staff_id, event_type, occurred_at, profiles!attendance_events_staff_id_fkey(full_name)")
      .order("occurred_at", { ascending: false })
      .limit(5);
    let leaveRowsQuery = admin
      .from("leave_requests")
      .select("id, staff_id, leave_type, status, start_date, end_date, profiles!leave_requests_staff_id_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(5);
    // "Getting started" checklist signals — always scoped to the
    // viewing admin's own org (not company-wide, even for a
    // platform_admin browsing a different org's overview).
    const companySettingsQuery = admin
      .from("company_settings")
      .select("address, gst_number, pan_number, state, bank_name, bank_account_number, bank_ifsc, upi_id")
      .eq("organization_id", profile!.organization_id)
      .maybeSingle();
    const departmentsCountQuery = admin.from("departments").select("id", { count: "exact", head: true }).eq("organization_id", profile!.organization_id);
    if (orgScope) {
      totalEmployeesQuery = totalEmployeesQuery.eq("organization_id", orgScope);
      checkinsQuery = checkinsQuery.eq("organization_id", orgScope);
      birthdaysQuery = birthdaysQuery.eq("organization_id", orgScope);
      payslipsQuery = payslipsQuery.eq("organization_id", orgScope);
      attendanceRowsQuery = attendanceRowsQuery.eq("organization_id", orgScope);
      leaveRowsQuery = leaveRowsQuery.eq("organization_id", orgScope);
    }

    const [
      { count: totalEmployees },
      { data: todaysCheckins },
      { data: allProfiles },
      { count: payslipsThisMonth },
      { data: attendanceRows },
      { data: leaveRows },
      { data: companySettingsRow },
      { count: departmentsCount },
    ] = await Promise.all([
      totalEmployeesQuery,
      checkinsQuery,
      birthdaysQuery,
      payslipsQuery,
      attendanceRowsQuery,
      leaveRowsQuery,
      companySettingsQuery,
      departmentsCountQuery,
    ]);
    gettingStarted = {
      businessSettingsDone: getMissingBusinessSettingsFields(companySettingsRow).length === 0,
      hasTeamMembers: (totalEmployees ?? 0) > 1,
      hasDepartments: (departmentsCount ?? 0) > 0,
    };

    const presentToday = new Set((todaysCheckins ?? []).map((e) => e.staff_id)).size;
    const total = totalEmployees ?? 0;
    const todayMD = new Date().toISOString().slice(5, 10);
    const birthdaysToday = (allProfiles ?? []).filter((p) => p.date_of_birth && p.date_of_birth.slice(5, 10) === todayMD).length;
    hrOverview = {
      totalEmployees: total,
      presentToday,
      absentToday: Math.max(0, total - presentToday),
      birthdaysToday,
      payrollDue: Math.max(0, total - (payslipsThisMonth ?? 0)),
    };

    recentAttendance = (attendanceRows ?? []).map((row) => {
      const r = row as unknown as { id: string; staff_id: string; event_type: string; occurred_at: string; profiles: { full_name: string } | null };
      return { id: r.id, staffId: r.staff_id, name: r.profiles?.full_name ?? "Unknown", eventType: r.event_type, occurredAt: r.occurred_at };
    });
    recentLeaveRequests = (leaveRows ?? []).map((row) => {
      const r = row as unknown as { id: string; leave_type: string; status: string; start_date: string; end_date: string; profiles: { full_name: string } | null };
      return { id: r.id, name: r.profiles?.full_name ?? "Unknown", leaveType: r.leave_type, status: r.status, startDate: r.start_date, endDate: r.end_date };
    });
  }

  const stats = staff
    ? [
        { label: "My Leads", value: leadsCount.count ?? 0, sub: "assigned to you", icon: PersonIcon, href: "/dashboard/crm" },
        { label: "Invoices", value: invoiceList.length, sub: `${pendingInvoices} awaiting payment`, icon: InvoiceIcon, href: "/dashboard/invoices" },
        { label: "Orders", value: orderList.length, sub: `${activeOrders} in progress`, icon: OrderIcon, href: "/dashboard/orders" },
      ]
    : [
        { label: "Invoices", value: invoiceList.length, sub: `${pendingInvoices} awaiting payment`, icon: InvoiceIcon, href: "/dashboard/invoices" },
        { label: "Orders", value: orderList.length, sub: `${activeOrders} in progress`, icon: OrderIcon, href: "/dashboard/orders" },
      ];

  return (
    <div>
      <DashboardPageHero
        title="Overview"
        subtitle={staff ? "Your work at a glance." : "Your account at a glance."}
      >
        <div className={`relative mt-6 grid grid-cols-2 gap-4 ${staff ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {stats.map((stat) => (
            <Link key={stat.label} href={stat.href}>
              <HeroKpi icon={stat.icon} label={stat.label} value={stat.value} />
            </Link>
          ))}
        </div>
      </DashboardPageHero>

      {isAdmin && gettingStarted && profile && (
        <div className="mt-6">
          <GettingStartedChecklist organizationId={profile.organization_id} {...gettingStarted} />
        </div>
      )}

      {isAdmin && hrOverview && (
        <div className="mt-8">
          <h2 className="text-lg font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
            HR Overview
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "Total Employees", value: hrOverview.totalEmployees, href: "/dashboard/admin/users" },
              { label: "Present Today", value: hrOverview.presentToday, href: "/dashboard/admin/attendance" },
              { label: "Absent Today", value: hrOverview.absentToday, href: "/dashboard/admin/attendance" },
              { label: "Today's Birthdays", value: hrOverview.birthdaysToday, href: "/dashboard/admin/users" },
              { label: "Payroll Due", value: hrOverview.payrollDue, href: "/dashboard/admin/payroll" },
            ].map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="rounded-2xl border p-4 backdrop-blur-xl transition-[box-shadow,border-color,transform] hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--color-accent)] dark:bg-[var(--color-paper-raised)]/80"
                style={{ borderColor: "var(--color-line)", backgroundColor: "rgba(255,255,255,0.78)" }}
              >
                <p className="text-2xl font-extrabold" style={{ color: "var(--color-ink)" }}>
                  <AnimatedCounter value={s.value} />
                </p>
                <p className="mt-0.5 text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>
                  {s.label}
                </p>
              </Link>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>
                  Recent Attendance
                </h3>
                <Link href="/dashboard/admin/attendance" className="text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
                  View all →
                </Link>
              </div>
              <ul className="mt-3 space-y-3">
                {recentAttendance.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <p className="font-medium" style={{ color: "var(--color-ink)" }}>
                      {a.name}
                    </p>
                    <span className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                      {a.eventType.replace("_", " ")} · {new Date(a.occurredAt).toLocaleString("en-IN")}
                    </span>
                  </li>
                ))}
                {recentAttendance.length === 0 && (
                  <li className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
                    No attendance events yet.
                  </li>
                )}
              </ul>
            </div>

            <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>
                  Recent Leave Requests
                </h3>
                <Link href="/dashboard/leave" className="text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
                  View all →
                </Link>
              </div>
              <ul className="mt-3 space-y-3">
                {recentLeaveRequests.map((l) => (
                  <li key={l.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium" style={{ color: "var(--color-ink)" }}>
                        {l.name}
                      </p>
                      <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                        {l.leaveType} · {new Date(l.startDate).toLocaleDateString("en-IN")}–{new Date(l.endDate).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <span className="text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>
                      {l.status}
                    </span>
                  </li>
                ))}
                {recentLeaveRequests.length === 0 && (
                  <li className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
                    No leave requests yet.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>
              Recent Orders
            </h2>
            <Link href="/dashboard/orders" className="text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
              View all →
            </Link>
          </div>
          <ul className="mt-3 space-y-3">
            {orderList.slice(0, 3).map((order) => (
              <li key={order.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium" style={{ color: "var(--color-ink)" }}>
                    {order.service}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                    {order.id.slice(0, 8)} · {new Date(order.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <span className="text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>
                  {order.status}
                </span>
              </li>
            ))}
            {orderList.length === 0 && (
              <li className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
                No orders yet.
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>
              Recent Invoices
            </h2>
            <Link href="/dashboard/invoices" className="text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
              View all →
            </Link>
          </div>
          <ul className="mt-3 space-y-3">
            {invoiceList.slice(0, 3).map((inv) => (
              <li key={inv.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium" style={{ color: "var(--color-ink)" }}>
                    {inv.invoice_number}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                    {new Date(inv.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                  ₹{Number(inv.total).toLocaleString("en-IN")}
                </span>
              </li>
            ))}
            {invoiceList.length === 0 && (
              <li className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
                No invoices yet.
              </li>
            )}
          </ul>
        </div>
      </div>

      {profile && !staff && (
        <Link
          href="/dashboard/crm-access"
          className="mt-8 flex items-center justify-between gap-3 rounded-2xl border bg-white p-5 transition-colors hover:bg-[var(--color-accent-tint)] dark:bg-[var(--color-paper-raised)]"
          style={{ borderColor: "var(--color-line)" }}
        >
          <div>
            <h2 className="font-semibold" style={{ color: "var(--color-ink)" }}>Want your own CRM?</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
              Every plan comes with a free year of your own CRM workspace — your own admin login, your own team, your own leads and invoicing.
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>Request CRM Access →</span>
        </Link>
      )}
    </div>
  );
}
