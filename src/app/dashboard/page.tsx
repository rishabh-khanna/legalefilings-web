"use client";

import Link from "next/link";
import { GlowBadge } from "@/components/CategoryIcons";
import { MOCK_CRM_CONTACTS, MOCK_INVOICES, MOCK_ORDERS } from "@/lib/dashboard-data";

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

export default function DashboardOverviewPage() {
  const pendingInvoices = MOCK_INVOICES.filter((i) => i.status !== "Paid").length;
  const activeOrders = MOCK_ORDERS.filter((o) => o.status !== "Completed").length;

  const stats = [
    { label: "CRM Contacts", value: MOCK_CRM_CONTACTS.length, sub: `${MOCK_CRM_CONTACTS.filter((c) => c.status === "Lead").length} new leads`, icon: PersonIcon, href: "/dashboard/crm" },
    { label: "Invoices", value: MOCK_INVOICES.length, sub: `${pendingInvoices} awaiting payment`, icon: InvoiceIcon, href: "/dashboard/invoices" },
    { label: "Orders", value: MOCK_ORDERS.length, sub: `${activeOrders} in progress`, icon: OrderIcon, href: "/dashboard/orders" },
  ];

  return (
    <div>
      <p className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}>
        Demo dashboard — everything below is mock data for review. The real backend comes next.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
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
            {MOCK_ORDERS.slice(0, 3).map((order) => (
              <li key={order.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium" style={{ color: "var(--color-ink)" }}>
                    {order.service}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                    {order.id} · {order.date}
                  </p>
                </div>
                <span className="text-xs font-medium" style={{ color: "var(--color-ink-soft)" }}>
                  {order.status}
                </span>
              </li>
            ))}
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
            {MOCK_INVOICES.slice(0, 3).map((inv) => (
              <li key={inv.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium" style={{ color: "var(--color-ink)" }}>
                    {inv.client}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
                    {inv.id} · {inv.date}
                  </p>
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                  ₹{inv.amount.toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
