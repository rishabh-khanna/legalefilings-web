import { TrendingUp, Clock, Users, ShoppingBag, Trophy } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";
import { isCollectableInvoiceType } from "@/lib/invoice-calc";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/lib/leads";
import { RevenueTrendChart, LeadsFunnelChart, OrdersStatusChart, StaffLeaderboardChart } from "@/components/AnalyticsCharts";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { AnimatedCounter } from "@/components/crm/AnimatedCounter";

export default async function AnalyticsPage() {
  const profile = await getCurrentProfile();
  const supabase = getSupabaseAdmin();

  // invoice_payments joined because "revenue" has to mean money actually
  // received, not invoice face value: a partially-paid invoice
  // contributes what was paid, not its total.
  let invoicesQuery = supabase.from("invoices").select("total, status, invoice_type, created_at, invoice_payments(amount, created_at)");
  let leadsQuery = supabase.from("leads").select("name, status, assigned_to");
  let ordersQuery = supabase.from("orders").select("service, plan, status");
  if (profile && !canSeeAllOrgs(profile)) {
    invoicesQuery = invoicesQuery.eq("organization_id", profile.organization_id);
    leadsQuery = leadsQuery.eq("organization_id", profile.organization_id);
    ordersQuery = ordersQuery.eq("organization_id", profile.organization_id);
  }

  const [{ data: invoices }, { data: leads }, { data: orders }] = await Promise.all([invoicesQuery, leadsQuery, ordersQuery]);

  // Revenue is collected cash — every recorded payment — not the sum of
  // issued invoices. Counting invoice totals reported unpaid and even
  // *draft* invoices (never sent to anyone) as earnings, overstating the
  // figure several times over and making the chart useless for any
  // decision that depends on what the business actually took in.
  // Outstanding is surfaced separately below rather than folded in.
  const revenueByMonth = new Map<string, number>();
  for (const inv of invoices ?? []) {
    for (const p of (inv.invoice_payments as { amount: number; created_at: string }[] | null) ?? []) {
      // Bucketed by when the payment landed, not when the invoice was
      // raised — an invoice issued in March and settled in June is June's
      // revenue.
      const d = new Date(p.created_at);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + Number(p.amount));
    }
  }
  // Sorted on the sortable YYYY-MM key before being formatted for
  // display. The chart previously rendered months in whatever order the
  // database happened to return rows, so the x-axis was arbitrary.
  const revenueData = Array.from(revenueByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, total]) => {
      const [y, m] = key.split("-").map(Number);
      return { month: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }), total };
    });

  const stageCounts = new Map<LeadStage, number>();
  for (const lead of leads ?? []) {
    stageCounts.set(lead.status, (stageCounts.get(lead.status) ?? 0) + 1);
  }
  const leadsData = Array.from(stageCounts.entries()).map(([stage, count]) => ({
    stage: LEAD_STAGE_LABELS[stage] ?? stage,
    count,
  }));

  const orderStatusCounts = new Map<string, number>();
  for (const order of orders ?? []) {
    orderStatusCounts.set(order.status, (orderStatusCounts.get(order.status) ?? 0) + 1);
  }
  const ordersData = Array.from(orderStatusCounts.entries()).map(([status, count]) => ({ status, count }));

  const staffStats = new Map<string, { won: number; assigned: number }>();
  for (const lead of leads ?? []) {
    if (!lead.assigned_to || lead.assigned_to === "Unassigned") continue;
    const entry = staffStats.get(lead.assigned_to) ?? { won: 0, assigned: 0 };
    entry.assigned += 1;
    if (lead.status === "won") entry.won += 1;
    staffStats.set(lead.assigned_to, entry);
  }
  const staffData = Array.from(staffStats.entries()).map(([name, stats]) => ({ name, ...stats }));

  const totalRevenue = (invoices ?? []).reduce(
    (sum, i) => sum + ((i.invoice_payments as { amount: number }[] | null) ?? []).reduce((s, p) => s + Number(p.amount), 0),
    0
  );
  // What has been billed and is still owed — the other half of the
  // picture, and the number that used to be silently bundled into
  // "revenue". Drafts are excluded: nobody has been asked to pay them.
  const totalOutstanding = (invoices ?? [])
    // Credit notes and proformas aren't receivables, so they can't be
    // outstanding — including them would inflate what customers owe.
    .filter((i) => ["sent", "partially_paid", "overdue"].includes(i.status) && isCollectableInvoiceType(i.invoice_type))
    .reduce((sum, i) => {
      const paid = ((i.invoice_payments as { amount: number }[] | null) ?? []).reduce((s, p) => s + Number(p.amount), 0);
      return sum + Math.max(0, Number(i.total) - paid);
    }, 0);

  const totalWon = (leads ?? []).filter((l) => l.status === "won").length;

  return (
    <div>
      <DashboardPageHero title="Analytics" subtitle="Company-wide performance, updated in real time from live data.">
        <div className="relative mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          {/* "Collected" rather than "Total Revenue" — this is money actually
              received. The old label sat above a figure that included unpaid
              and even draft invoices, which read as earnings. */}
          <HeroKpi icon={<TrendingUp className="h-4 w-4" />} label="Collected" value={<AnimatedCounter value={totalRevenue} prefix="₹" />} />
          <HeroKpi icon={<Clock className="h-4 w-4" />} label="Outstanding" value={<AnimatedCounter value={totalOutstanding} prefix="₹" />} />
          <HeroKpi icon={<Users className="h-4 w-4" />} label="Total Leads" value={<AnimatedCounter value={(leads ?? []).length} />} />
          <HeroKpi icon={<ShoppingBag className="h-4 w-4" />} label="Total Orders" value={<AnimatedCounter value={(orders ?? []).length} />} />
          <HeroKpi icon={<Trophy className="h-4 w-4" />} label="Deals Won" value={<AnimatedCounter value={totalWon} />} />
        </div>
      </DashboardPageHero>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <RevenueTrendChart data={revenueData} />
        <LeadsFunnelChart data={leadsData} />
        <OrdersStatusChart data={ordersData} />
        <StaffLeaderboardChart data={staffData} />
      </div>
    </div>
  );
}
