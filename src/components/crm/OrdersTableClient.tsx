"use client";

import { useMemo, useState } from "react";
import { FileText, CheckCircle2 } from "lucide-react";
import { OrderDocumentsDrawer, DOCUMENT_STATUS_LABEL, DOCUMENT_STATUS_STYLE, type OrderDocumentStatus } from "@/components/crm/OrderDocumentsDrawer";
import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE, type OrderStatus } from "@/lib/order-status";
import { usePagination } from "@/lib/use-pagination";
import { TablePagination } from "@/components/TablePagination";
import { useDateRangeFilter } from "@/lib/use-date-range-filter";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ExportButton } from "@/components/ExportButton";

type OrderRow = {
  id: string;
  service: string;
  plan: string;
  plan_price: number | null;
  status: OrderStatus;
  document_status: OrderDocumentStatus;
  payment_status: string;
  created_at: string;
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
  paid: { bg: "#d0f4db", fg: "#116a2c" },
  partially_paid: { bg: "#fff6d9", fg: "#8a6700" },
  sent: { bg: "#fff6d9", fg: "#8a6700" },
  overdue: { bg: "#fde2e2", fg: "#b42318" },
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
export function OrdersTableClient({ orders: initialOrders, isStaff }: { orders: OrderRow[]; isStaff: boolean }) {
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
  const dateFilter = useDateRangeFilter(visibleOrders, (o) => o.created_at);

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const filteredOrders = useMemo(() => {
    return dateFilter.filtered.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${o.service} ${o.plan} ${o.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [dateFilter.filtered, statusFilter, search]);

  const { page, setPage, pageSize, setPageSize, pageItems: pagedOrders, totalPages, total, start, end } = usePagination(filteredOrders);

  return (
    <>
      {/* One continuous card for the whole data section (filters →
          pagination → table) instead of those living as loose,
          separately-bordered pieces stacked under the hero — the filter
          row and Export button used to just float in blank page space
          with nothing marking where "the table" actually begins. */}
      <div className="overflow-hidden rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" style={{ borderColor: "var(--color-line)" }}>
          {isStaff && (
            <button
              type="button"
              onClick={() => setReadyOnly((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              style={
                readyOnly
                  ? { backgroundColor: "#d0f4db", borderColor: "#116a2c", color: "#116a2c" }
                  : { borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }
              }
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {readyOnly ? "Showing ready to work" : "Ready to work"} ({readyCount})
            </button>
          )}
          <div className="flex flex-wrap items-end gap-3">
            {/* Each control below wrapped in the same "invisible label +
                input" shape DateRangeFilter uses internally, so every
                control's input row lines up on one baseline instead of
                the ones without a label sitting lower under items-end. */}
            <div>
              <label className="mb-1 block text-xs font-medium invisible" aria-hidden="true">Search</label>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order, plan…"
                className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
                style={{ borderColor: "var(--color-line)" }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium invisible" aria-hidden="true">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "all")}
                className="rounded-lg border px-2.5 py-2 text-sm outline-none"
                style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
              >
                <option value="all">All statuses</option>
                {Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <DateRangeFilter
              from={dateFilter.from}
              to={dateFilter.to}
              onFromChange={dateFilter.setFrom}
              onToChange={dateFilter.setTo}
              onClear={dateFilter.clear}
              active={dateFilter.active}
            />
            {(search.trim() || statusFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
                className="pb-2.5 text-xs font-semibold"
                style={{ color: "var(--color-action-dark)" }}
              >
                Clear filters
              </button>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium invisible" aria-hidden="true">Export</label>
              <ExportButton
              filename="orders"
              headers={["Order", "Amount", "Date", "Payment", "Process", "Documents"]}
              rows={filteredOrders.map((order) => [
                `${order.service} — ${order.plan}`,
                order.plan_price ? Number(order.plan_price) : "",
                new Date(order.created_at).toLocaleDateString("en-IN"),
                PAYMENT_STATUS_LABEL[order.payment_status] ?? "Not Invoiced",
                ORDER_STATUS_LABEL[order.status],
                DOCUMENT_STATUS_LABEL[order.document_status],
              ])}
            />
            </div>
          </div>
        </div>

        <div className="border-b px-4 py-2.5" style={{ borderColor: "var(--color-line)" }}>
          <TablePagination
            page={page}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            start={start}
            end={end}
            total={total}
            itemLabel="orders"
          />
        </div>

        <div className="overflow-x-auto">
        {/* Order/Service/Plan collapsed into one column (was 3 separate
            ones) — that plus tighter padding is what gets an 8-column
            status table to actually fit without horizontal scroll on a
            normal/wide screen. table-fixed alone has no width floor
            though — on a narrow (mobile) viewport it would just keep
            shrinking every column instead of ever triggering the
            overflow-x-auto scroll, squeezing badges/text down to
            unreadable. min-w gives it a floor: fits without scrolling
            once there's enough room, scrolls horizontally below that. */}
        <table className="dt-table w-full min-w-[640px] table-fixed text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="w-[4%] px-3 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>#</th>
              <th className="w-[20%] px-3 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Order</th>
              <th className="w-[10%] whitespace-nowrap px-3 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Amount</th>
              <th className="w-[10%] whitespace-nowrap px-3 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Date</th>
              <th className="w-[15%] whitespace-nowrap px-3 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Payment</th>
              <th className="w-[14%] whitespace-nowrap px-3 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Process</th>
              <th className="w-[27%] whitespace-nowrap px-3 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Documents</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {pagedOrders.map((order, i) => {
              const style = ORDER_STATUS_STYLE[order.status];
              const docStyle = DOCUMENT_STATUS_STYLE[order.document_status];
              const payStyle = PAYMENT_STATUS_STYLE[order.payment_status] ?? PAYMENT_STATUS_STYLE.no_invoice;
              const payLabel = PAYMENT_STATUS_LABEL[order.payment_status] ?? "Not Invoiced";
              const ready = isReadyToWork(order);
              return (
                <tr
                  key={order.id}
                  style={{ borderColor: "var(--color-line)", ...(ready ? { boxShadow: "inset 3px 0 0 #116a2c" } : {}) }}
                >
                  <td className="overflow-hidden px-3 py-3" style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                  <td className="overflow-hidden px-3 py-3">
                    <p className="truncate font-medium" style={{ color: "var(--color-ink)" }}>{order.service}</p>
                    <p className="truncate text-xs" style={{ color: "var(--color-ink-soft)" }}>{order.plan} · {order.id.slice(0, 8)}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>
                    {order.plan_price ? `₹${Number(order.plan_price).toLocaleString("en-IN")}` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3" style={{ color: "var(--color-ink-soft)" }}>
                    {new Date(order.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="overflow-hidden whitespace-nowrap px-3 py-3">
                    <span className="inline-block whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold" style={{ backgroundColor: payStyle.bg, color: payStyle.fg }}>
                      {payLabel}
                    </span>
                  </td>
                  <td className="overflow-hidden whitespace-nowrap px-3 py-3">
                    {isStaff ? (
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
                    )}
                  </td>
                  <td className="overflow-hidden whitespace-nowrap px-3 py-3">
                    <button
                      type="button"
                      onClick={() => setActiveOrderId(order.id)}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold transition-transform hover:scale-[1.03]"
                      style={{ backgroundColor: docStyle.bg, color: docStyle.fg }}
                    >
                      <FileText className="h-3 w-3" />
                      {DOCUMENT_STATUS_LABEL[order.document_status]}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
                  {orders.length === 0
                    ? "No orders yet."
                    : visibleOrders.length === 0
                      ? "No orders are ready to work on right now."
                      : search.trim() || statusFilter !== "all"
                        ? "No orders match this filter."
                        : "No orders in this date range."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

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
