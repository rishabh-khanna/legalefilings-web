import Link from "next/link";
import { GlowBadge } from "@/components/CategoryIcons";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";

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
  const supabase = await createSupabaseServerClient();
  const staff = profile ? isStaffOrAdmin(profile) : false;

  let ordersQuery = supabase.from("orders").select("id, service, status, created_at").order("created_at", { ascending: false });
  let invoicesQuery = supabase.from("invoices").select("id, invoice_number, total, status, created_at").order("created_at", { ascending: false });
  if (profile && !staff) {
    ordersQuery = ordersQuery.eq("customer_id", profile.id);
    invoicesQuery = invoicesQuery.eq("customer_id", profile.id);
  }

  const [{ data: orders }, { data: invoices }, leadsCount] = await Promise.all([
    ordersQuery,
    invoicesQuery,
    staff && profile
      ? supabase.from("leads").select("id", { count: "exact", head: true }).eq("assigned_to", profile.full_name ?? "")
      : Promise.resolve({ count: 0 }),
  ]);

  const orderList = orders ?? [];
  const invoiceList = invoices ?? [];
  const activeOrders = orderList.filter((o) => !["completed", "cancelled"].includes(o.status)).length;
  const pendingInvoices = invoiceList.filter((i) => i.status !== "paid").length;

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
      <div className={`grid gap-4 ${staff ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-2xl border bg-white p-5 transition-[box-shadow,border-color] hover:shadow-md hover:border-[var(--color-accent)] dark:bg-[var(--color-paper-raised)]"
            style={{ borderColor: "var(--color-line)" }}
          >
            <GlowBadge size={40} icon={<stat.icon className="h-[18px] w-[18px]" />} />
            <p className="mt-3 text-2xl font-extrabold" style={{ color: "var(--color-ink)" }}>
              {stat.value}
            </p>
            <p className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
              {stat.label}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--color-ink-soft)" }}>
              {stat.sub}
            </p>
          </Link>
        ))}
      </div>

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
    </div>
  );
}
