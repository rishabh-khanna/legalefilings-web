"use client";

import { useMemo, useState } from "react";
import { FileText, CheckCircle2 } from "lucide-react";
import { OrderDocumentsDrawer, DOCUMENT_STATUS_LABEL, DOCUMENT_STATUS_STYLE, type OrderDocumentStatus } from "@/components/crm/OrderDocumentsDrawer";
import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE, type OrderStatus } from "@/lib/order-status";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { MultiSelect } from "@/components/MultiSelect";
import { SearchButton } from "@/components/SearchButton";

type OrderRow = {
  id: string;
  customer_id: string;
  service: string;
  plan: string;
  plan_price: number | null;
  status: OrderStatus;
  document_status: OrderDocumentStatus;
  payment_status: string;
  created_at: string;
  profiles?: { full_name: string | null; company: string | null } | null;
  organizations?: { name: string | null } | null;
  creator?: { full_name: string | null } | null;
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  partially_paid: "Partially Paid",
  sent: "Payment Pending",
  overdue: "Overdue",
  draft: "Not Invoiced",
  cancelled: "Cancelled",
  no_invoice: "Not Invoiced",
};

const PAYMENT_STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  paid: { bg: "var(--color-success-tint)", fg: "var(--color-success)" },
  partially_paid: { bg: "var(--color-action-tint)", fg: "var(--color-action-dark)" },
  sent: { bg: "var(--color-action-tint)", fg: "var(--color-action-dark)" },
  overdue: { bg: "var(--color-danger-tint)", fg: "var(--color-danger)" },
  draft: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  cancelled: { bg: "var(--color-paper)", fg: "var(--color-ink-soft)" },
  no_invoice: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
};

// Payment Status, Process Status, and Document Status each update
// independently — there was no single place that answered "is this
// order actually paid AND verified, i.e. ready to start the filing
// work," forcing staff to mentally cross-reference three badges per
// row. This is that combined signal: fully paid + documents verified +
// not already finished.
function isReadyToWork(order: OrderRow): boolean {
  return order.payment_status === "paid" && order.document_status === "verified" && order.status !== "completed" && order.status !== "cancelled";
}

// The interactive half of the orders table (server component fetches
// the rows; this handles the documents drawer) — kept as its own client
// component so the initial data fetch stays server-side.
export function OrdersTableClient({ orders: initialOrders, isStaff, spansMultipleOrgs }: { orders: OrderRow[]; isStaff: boolean; spansMultipleOrgs?: boolean }) {
  const [orders, setOrders] = useState(initialOrders);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [readyOnly, setReadyOnly] = useState(false);

  function handleStatusChange(orderId: string, status: OrderDocumentStatus) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, document_status: status } : o)));
  }

  function handleOrderStatusChange(orderId: string, status: OrderStatus) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
  }

  const activeOrder = orders.find((o) => o.id === activeOrderId) ?? null;
  const readyCount = useMemo(() => orders.filter(isReadyToWork).length, [orders]);
  const visibleOrders = isStaff && readyOnly ? orders.filter(isReadyToWork) : orders;

  // Both apply on Search rather than the instant an option is checked —
  // draft* is what the MultiSelects are bound to, the non-draft pair is
  // what actually filters. Same convention every other status/type
  // toolbar filter in the app uses.
  const [draftStatusFilter, setDraftStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const statusFilteredOrders = useMemo(
    () => (statusFilter.size === 0 ? visibleOrders : visibleOrders.filter((o) => statusFilter.has(o.status))),
    [visibleOrders, statusFilter]
  );

  // Replaces the old group-by-customer clustering (isStaff only — a
  // customer's own order list was never grouped, it's already just
  // theirs) with one dropdown to narrow the table to a single customer
  // instead of the whole list visually reorganized around them.
  const [draftCustomerFilter, setDraftCustomerFilter] = useState<Set<string>>(new Set());
  const [customerFilter, setCustomerFilter] = useState<Set<string>>(new Set());
  const customerOptions = useMemo(() => {
    if (!isStaff) return [];
    const byId = new Map<string, string>();
    for (const o of orders) {
      if (!byId.has(o.customer_id)) byId.set(o.customer_id, o.profiles?.full_name ?? "—");
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders, isStaff]);
  const customerFilteredOrders = useMemo(
    () => (customerFilter.size === 0 ? statusFilteredOrders : statusFilteredOrders.filter((o) => customerFilter.has(o.customer_id))),
    [statusFilteredOrders, customerFilter]
  );
  const orderFiltersDirty =
    draftStatusFilter.size !== statusFilter.size || [...draftStatusFilter].some((v) => !statusFilter.has(v)) ||
    draftCustomerFilter.size !== customerFilter.size || [...draftCustomerFilter].some((v) => !customerFilter.has(v));

  function orderSearchText(o: OrderRow) {
    return `${o.service} ${o.plan} ${o.id} ${o.profiles?.full_name ?? ""} ${o.profiles?.company ?? ""}`;
  }

  const emptyMessage =
    orders.length === 0
      ? "No orders yet."
      : readyOnly && visibleOrders.length === 0
        ? "No orders are ready to work on right now."
        : "No orders match this filter.";

  const orderColumns: DataTableColumn<OrderRow>[] = [
    {
      key: "order",
      header: "Order",
      className: "w-[20%]",
      render: (order) => (
        <>
          <p className="truncate font-medium" style={{ color: "var(--color-ink)" }}>{order.service}</p>
          <p className="truncate text-xs" style={{ color: "var(--color-ink-soft)" }}>{order.plan} · {order.id.slice(0, 8)}</p>
        </>
      ),
      exportValue: (order) => `${order.service} — ${order.plan}`,
      sortValue: (order) => `${order.service} — ${order.plan}`,
    },
    ...(isStaff
      ? [{
          key: "customer",
          header: "Customer",
          className: "w-[16%]",
          render: (order: OrderRow) => (
            <>
              <p className="truncate font-medium" style={{ color: "var(--color-ink)" }}>{order.profiles?.full_name ?? "—"}</p>
              {order.profiles?.company && <p className="truncate text-xs" style={{ color: "var(--color-ink-soft)" }}>{order.profiles.company}</p>}
            </>
          ),
          exportValue: (order: OrderRow) => order.profiles?.full_name ?? "",
          sortValue: (order: OrderRow) => order.profiles?.full_name,
        } as DataTableColumn<OrderRow>]
      : []),
    {
      key: "amount",
      header: "Amount",
      className: "w-[10%] whitespace-nowrap font-semibold",
      render: (order) => (order.plan_price ? `₹${Number(order.plan_price).toLocaleString("en-IN")}` : "—"),
      exportValue: (order) => (order.plan_price ? Number(order.plan_price) : ""),
      sortValue: (order) => (order.plan_price ? Number(order.plan_price) : null),
    },
    {
      key: "date",
      header: "Date",
      className: "w-[10%] whitespace-nowrap",
      render: (order) => new Date(order.created_at).toLocaleDateString("en-IN"),
      exportValue: (order) => new Date(order.created_at).toLocaleDateString("en-IN"),
      sortValue: (order) => order.created_at,
    },
    ...(isStaff
      ? [{
          key: "createdBy",
          header: "Created By",
          className: "w-[10%] whitespace-nowrap",
          render: (order: OrderRow) => order.creator?.full_name ?? <span style={{ color: "var(--color-ink-soft)" }}>Self-checkout</span>,
          exportValue: (order: OrderRow) => order.creator?.full_name ?? "Self-checkout",
          sortValue: (order: OrderRow) => order.creator?.full_name,
        } as DataTableColumn<OrderRow>]
      : []),
    {
      key: "payment",
      header: "Payment",
      className: "w-[15%] whitespace-nowrap",
      render: (order) => {
        const payStyle = PAYMENT_STATUS_STYLE[order.payment_status] ?? PAYMENT_STATUS_STYLE.no_invoice;
        const payLabel = PAYMENT_STATUS_LABEL[order.payment_status] ?? "Not Invoiced";
        return <span className="inline-block whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold" style={{ backgroundColor: payStyle.bg, color: payStyle.fg }}>{payLabel}</span>;
      },
      exportValue: (order) => PAYMENT_STATUS_LABEL[order.payment_status] ?? "Not Invoiced",
      sortValue: (order) => PAYMENT_STATUS_LABEL[order.payment_status] ?? "Not Invoiced",
    },
    {
      key: "process",
      header: "Process",
      className: "w-[14%] whitespace-nowrap",
      render: (order) => {
        const style = ORDER_STATUS_STYLE[order.status];
        return isStaff ? (
          <button
            type="button"
            onClick={() => setActiveOrderId(order.id)}
            className="inline-flex items-center whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: style.bg, color: style.fg }}
          >
            {ORDER_STATUS_LABEL[order.status]}
          </button>
        ) : (
          <span className="inline-block whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
            {ORDER_STATUS_LABEL[order.status]}
          </span>
        );
      },
      exportValue: (order) => ORDER_STATUS_LABEL[order.status],
      sortValue: (order) => ORDER_STATUS_LABEL[order.status],
    },
    {
      key: "documents",
      header: "Documents",
      className: "w-[27%] whitespace-nowrap",
      render: (order) => {
        const docStyle = DOCUMENT_STATUS_STYLE[order.document_status];
        return (
          <button
            type="button"
            onClick={() => setActiveOrderId(order.id)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: docStyle.bg, color: docStyle.fg }}
          >
            <FileText className="h-3 w-3" />
            {DOCUMENT_STATUS_LABEL[order.document_status]}
          </button>
        );
      },
      exportValue: (order) => DOCUMENT_STATUS_LABEL[order.document_status],
      sortValue: (order) => DOCUMENT_STATUS_LABEL[order.document_status],
    },
    ...(spansMultipleOrgs
      ? [{ key: "org", header: "Organization", className: "w-[14%] whitespace-nowrap", render: (order: OrderRow) => order.organizations?.name ?? "—", exportValue: (order: OrderRow) => order.organizations?.name ?? "Unknown organization" } as DataTableColumn<OrderRow>]
      : []),
  ];

  return (
    <>
      <DataTable
        columns={orderColumns}
        rows={customerFilteredOrders}
        getRowKey={(order) => order.id}
        itemLabel="orders"
        emptyMessage={emptyMessage}
        filteredEmptyMessage="No orders match this filter."
        search={{ placeholder: "Search order, plan…", filter: (order, q) => orderSearchText(order).toLowerCase().includes(q) }}
        dateFilter={{ getDate: (order) => order.created_at }}
        exportFilename="orders"
        minWidth={640}
        rowStyle={(order) => (isReadyToWork(order) ? { boxShadow: "inset 3px 0 0 var(--color-success)" } : undefined)}
        toolbar={
          <>
            {isStaff && (
              <button
                type="button"
                onClick={() => setReadyOnly((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                style={
                  readyOnly
                    ? { backgroundColor: "var(--color-success-tint)", borderColor: "var(--color-success)", color: "var(--color-success)" }
                    : { borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {readyOnly ? "Showing ready to work" : "Ready to work"} ({readyCount})
              </button>
            )}
            <MultiSelect
              options={Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
              selected={draftStatusFilter}
              onChange={setDraftStatusFilter}
              placeholder="All statuses"
            />
            {isStaff && (
              <MultiSelect
                options={customerOptions.map(([id, name]) => ({ value: id, label: name }))}
                selected={draftCustomerFilter}
                onChange={setDraftCustomerFilter}
                placeholder="All customers"
                searchable
              />
            )}
            <SearchButton
              onClick={() => {
                setStatusFilter(draftStatusFilter);
                setCustomerFilter(draftCustomerFilter);
              }}
              dirty={orderFiltersDirty}
            />
          </>
        }
      />

      <OrderDocumentsDrawer
        orderId={activeOrderId}
        orderLabel={activeOrder ? `${activeOrder.service} — ${activeOrder.id.slice(0, 8)}` : ""}
        isStaff={isStaff}
        orderStatus={activeOrder?.status ?? null}
        onClose={() => setActiveOrderId(null)}
        onStatusChange={handleStatusChange}
        onOrderStatusChange={handleOrderStatusChange}
      />
    </>
  );
}
