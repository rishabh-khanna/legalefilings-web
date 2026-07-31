import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/lib/leads";
import { RevenueTrendChart, LeadsFunnelChart, OrdersStatusChart, StaffLeaderboardChart } from "@/components/AnalyticsCharts";

export default async function AnalyticsPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: invoices }, { data: leads }, { data: orders }] = await Promise.all([
    supabase.from("invoices").select("total, status, created_at"),
    supabase.from("leads").select("status, assigned_to"),
    supabase.from("orders").select("status"),
  ]);

  const revenueByMonth = new Map<string, number>();
  for (const inv of invoices ?? []) {
    if (inv.status === "cancelled") continue;
    const month = new Date(inv.created_at).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    revenueByMonth.set(month, (revenueByMonth.get(month) ?? 0) + Number(inv.total));
  }
  const revenueData = Array.from(revenueByMonth.entries()).map(([month, total]) => ({ month, total }));

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

  const totalRevenue = (invoices ?? []).filter((i) => i.status !== "cancelled").reduce((sum, i) => sum + Number(i.total), 0);

  return (
    <div>
      <h2 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>Analytics</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
        Total revenue to date: <span className="font-semibold" style={{ color: "var(--color-ink)" }}>₹{totalRevenue.toLocaleString("en-IN")}</span>
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <RevenueTrendChart data={revenueData} />
        <LeadsFunnelChart data={leadsData} />
        <OrdersStatusChart data={ordersData} />
        <StaffLeaderboardChart data={staffData} />
      </div>
    </div>
  );
}
