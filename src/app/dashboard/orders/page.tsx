import { Package, Loader2, CheckCircle2, IndianRupee } from "lucide-react";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { OrdersTableClient } from "@/components/crm/OrdersTableClient";
import type { OrderDocumentStatus } from "@/components/crm/OrderDocumentsDrawer";

type OrderRow = {
  id: string;
  customer_id: string;
  service: string;
  plan: string;
  plan_price: number | null;
  status: "new" | "assigned" | "in_progress" | "under_review" | "completed" | "cancelled";
  document_status: OrderDocumentStatus;
  created_at: string;
  organization_id: string;
  profiles?: { full_name: string | null; company: string | null } | null;
  organizations?: { name: string | null } | null;
};

export default async function OrderHistoryPage() {
  const profile = await getCurrentProfile();
  const supabase = getSupabaseAdmin();

  // organizations(name) only actually matters for a platform_admin, who
  // sees every org's orders pooled together here — without it, there'd
  // be no way to tell which tenant an order belongs to.
  let query = supabase
    .from("orders")
    .select("*, profiles!orders_customer_id_fkey(full_name, company), organizations(name)")
    .order("created_at", { ascending: false });
  if (profile?.account_type === "customer") {
    query = query.eq("customer_id", profile.id);
  } else if (profile) {
    if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
    // canSeeAllOrgs (is_platform_admin) must also skip the reporting-chain
    // narrowing below — independent axis from account_type, so a
    // platform_admin without account_type "admin" would otherwise pass
    // the org filter above (every org) and then get wrongly narrowed
    // straight back down to their own chain here.
    if (profile.account_type !== "admin" && !canSeeAllOrgs(profile)) {
      // A rater sees only orders assigned to them; a leader/group_leader
      // sees their own plus their reporting chain's — not the whole
      // company's order book. Unassigned orders (assigned_to is null —
      // every order from the public checkout flow, or anything an admin
      // hasn't manually assigned yet) stay visible to everyone at this
      // level too, matching the RLS policy this mirrors (20260804010000)
      // — Postgres `IN` never matches NULL, so without the explicit
      // `.is("assigned_to", null)` branch every unassigned order was
      // invisible to every rater/leader/group_leader, with no way for
      // anyone below admin to even discover there was new work to pick
      // up.
      const chain = await getReportingChainIds(profile.id);
      query = query.or(`assigned_to.is.null,assigned_to.in.(${[profile.id, ...chain].join(",")})`);
    }
  }
  const { data } = await query;
  const orders = (data as OrderRow[] | null) ?? [];
  const activeOrders = orders.filter((o) => !["completed", "cancelled"].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === "completed");
  const totalValue = orders.reduce((sum, o) => sum + Number(o.plan_price ?? 0), 0);

  // Payment status is its own thing from the order's process status — an
  // order can be fully paid and still in progress, or unpaid and still
  // sitting at "new". Pulled from the order's own invoice, not implied
  // by the pipeline stage.
  const orderIds = orders.map((o) => o.id);
  const { data: invoices } = orderIds.length
    ? await supabase.from("invoices").select("order_id, status").in("order_id", orderIds)
    : { data: [] as { order_id: string; status: string }[] };
  const paymentStatusByOrderId = new Map<string, string>();
  for (const inv of invoices ?? []) {
    if (!paymentStatusByOrderId.has(inv.order_id)) paymentStatusByOrderId.set(inv.order_id, inv.status);
  }
  const ordersWithPayment = orders.map((o) => ({ ...o, payment_status: paymentStatusByOrderId.get(o.id) ?? "no_invoice" }));

  // Only a platform_admin's request ever returns more than one org's
  // orders pooled together — the column is only worth showing once it's
  // actually ambiguous which org a row belongs to.
  const spansMultipleOrgs = new Set(orders.map((o) => o.organization_id)).size > 1;

  return (
    <div>
      <DashboardPageHero
        title={profile && isStaffOrAdmin(profile) ? "Orders" : "Order History"}
        subtitle={
          spansMultipleOrgs
            ? "Every organization's orders, pooled here for platform-level support."
            : profile && isStaffOrAdmin(profile)
              ? "Every engagement across all customers."
              : "Every registration and filing you've ordered with us."
        }
      >
        {/* Plain stat tiles, not the click-for-a-popup-list treatment
            most KPIs elsewhere get — the table right below already has
            a status filter, search, sort, and click-to-open-documents
            per row, so a popup here would just be a strictly worse,
            non-interactive re-listing of the same rows. */}
        <div className="relative mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <HeroKpi icon={<Package className="h-4 w-4" />} label="Total Orders" value={orders.length} />
          <HeroKpi icon={<Loader2 className="h-4 w-4" />} label="In Progress" value={activeOrders.length} />
          <HeroKpi icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={completedOrders.length} />
          <HeroKpi icon={<IndianRupee className="h-4 w-4" />} label="Total Value" value={`₹${totalValue.toLocaleString("en-IN")}`} />
        </div>
      </DashboardPageHero>

      <OrdersTableClient orders={ordersWithPayment} isStaff={Boolean(profile && isStaffOrAdmin(profile))} spansMultipleOrgs={spansMultipleOrgs} />
    </div>
  );
}
