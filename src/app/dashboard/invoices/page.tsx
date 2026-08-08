"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, CheckCircle2, Clock, IndianRupee } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isStaffOrAdmin, type Profile } from "@/lib/roles";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { usePagination } from "@/lib/use-pagination";
import { TablePagination } from "@/components/TablePagination";
import { useDateRangeFilter } from "@/lib/use-date-range-filter";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ExportButton } from "@/components/ExportButton";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_type: string;
  order_id: string | null;
  total: number;
  status: "draft" | "sent" | "paid" | "partially_paid" | "overdue" | "cancelled";
  created_at: string;
  due_at: string | null;
  customer_id: string;
  profiles?: { full_name: string | null; company: string | null } | null;
  invoice_payments?: { amount: number }[];
};

const STATUS_STYLE: Record<InvoiceRow["status"], { bg: string; fg: string }> = {
  draft: { bg: "var(--color-paper)", fg: "var(--color-ink-soft)" },
  sent: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  paid: { bg: "#d0f4db", fg: "#116a2c" },
  partially_paid: { bg: "#fff6d9", fg: "#8a6700" },
  overdue: { bg: "#fde2e2", fg: "#b42318" },
  cancelled: { bg: "var(--color-paper)", fg: "var(--color-ink-soft)" },
};

// Order Invoices only — every invoice here has an order behind it
// (Buy Plan for Customer, or direct checkout). The ad-hoc GST wizard
// (types, HSN, credit/debit notes, catalog, attachments, etc.) lives
// entirely on the separate /dashboard/invoice-crm page — staff/admin
// only, or a customer once their own CRM access is approved (see
// /dashboard/crm-access). This page used to also let a plain paid
// customer self-generate a simple invoice right here, which just
// duplicated (with less capability) what Invoice CRM already does and
// had no real reason to exist on what's meant to be a read-mostly
// "here's what's been billed to you" list.
export default function InvoicesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { message, showSuccess, showError } = useActionMessage();

  const [statusFilter, setStatusFilter] = useState<InvoiceRow["status"] | "all">("all");
  const [payingInvoice, setPayingInvoice] = useState<InvoiceRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("Bank Transfer");
  const [payTxnId, setPayTxnId] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);

  async function loadInvoices() {
    const res = await fetch("/api/invoices");
    const data = await res.json();
    setInvoices((data.invoices as InvoiceRow[] | undefined) ?? []);
  }

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (p) setProfile({ ...p, email: user.email ?? "" });
      await loadInvoices();
      setLoading(false);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  const canManage = profile ? isStaffOrAdmin(profile) : false;

  const orderInvoices = useMemo(() => invoices.filter((i) => canManage ? i.order_id : true), [invoices, canManage]);
  const statusFilteredInvoices = useMemo(
    () => (statusFilter === "all" ? orderInvoices : orderInvoices.filter((i) => i.status === statusFilter)),
    [orderInvoices, statusFilter]
  );
  const dateFilter = useDateRangeFilter(statusFilteredInvoices, (i) => i.created_at);
  const filteredInvoices = dateFilter.filtered;
  const { page, setPage, pageSize, setPageSize, pageItems: pagedInvoices, totalPages, total, start, end } = usePagination(filteredInvoices);

  const invoiceStats = useMemo(() => {
    const paid = orderInvoices.filter((i) => i.status === "paid").length;
    const totalValue = orderInvoices.filter((i) => i.status !== "cancelled").reduce((sum, i) => sum + Number(i.total), 0);
    return { total: orderInvoices.length, paid, pending: orderInvoices.length - paid, totalValue };
  }, [orderInvoices]);

  async function handleRecordPayment() {
    if (!payingInvoice || !payAmount) return;
    setRecordingPayment(true);
    const res = await fetch(`/api/invoices/${payingInvoice.id}/record-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(payAmount), paymentMode: payMode, transactionId: payTxnId || undefined }),
    });
    setRecordingPayment(false);
    if (res.ok) {
      await loadInvoices();
      setPayingInvoice(null);
      setPayAmount("");
      setPayTxnId("");
      showSuccess("Payment recorded.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to record payment.");
    }
  }

  function balanceOf(inv: InvoiceRow) {
    const paid = (inv.invoice_payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    return Math.max(0, Number(inv.total) - paid);
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  if (loading) {
    return <LoadingBlock />;
  }

  return (
    <div>
      <DashboardPageHero
        title={canManage ? "Order Invoices" : "My Invoices"}
        subtitle={
          canManage
            ? "Invoices generated from purchases — Buy Plan for Customer and direct checkout. For ad-hoc billing, use Invoice CRM."
            : "Invoices issued to your account."
        }
      >
        <div className="relative mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <HeroKpi icon={FileText} label="Total" value={invoiceStats.total} />
          <HeroKpi icon={CheckCircle2} label="Paid" value={invoiceStats.paid} />
          <HeroKpi icon={Clock} label="Pending" value={invoiceStats.pending} />
          <HeroKpi icon={IndianRupee} label="Total Value" value={`₹${invoiceStats.totalValue.toLocaleString("en-IN")}`} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(15,23,42,0.4)" }} onClick={() => setPayingInvoice(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-[var(--color-paper-raised)]" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold" style={{ color: "var(--color-ink)" }}>Record Payment — {payingInvoice.invoice_number}</p>
            <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Balance outstanding: ₹{balanceOf(payingInvoice).toLocaleString("en-IN")}</p>
            <div className="mt-3 space-y-2">
              <input type="number" min="0" placeholder="Amount Received (₹)" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              <select value={payMode} onChange={(e) => setPayMode(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                <option>Cash</option>
                <option>Bank Transfer</option>
                <option>UPI</option>
                <option>Credit Card</option>
                <option>Cheque</option>
                <option>Razorpay</option>
              </select>
              <input placeholder="Transaction ID (optional)" value={payTxnId} onChange={(e) => setPayTxnId(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={handleRecordPayment} disabled={recordingPayment} className="flex-1 rounded-full py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
                {recordingPayment ? "Saving…" : "Record Payment"}
              </button>
              <button type="button" onClick={() => setPayingInvoice(null)} className="rounded-full border px-4 py-2 text-sm font-medium" style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <div className="flex flex-wrap items-end justify-end gap-3 border-b p-4" style={{ borderColor: "var(--color-line)" }}>
          <DateRangeFilter
            from={dateFilter.from}
            to={dateFilter.to}
            onFromChange={dateFilter.setFrom}
            onToChange={dateFilter.setTo}
            onClear={dateFilter.clear}
            active={dateFilter.active}
          />
          {/* Matches DateRangeFilter's own "label row + input row"
              structure (an invisible label of the same height) so this
              select's input lines up with the date inputs' baseline
              instead of sitting lower once items-end is measuring two
              different control heights. */}
          <div>
            <label className="mb-1 block text-xs font-medium invisible" aria-hidden="true">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as InvoiceRow["status"] | "all")}
              className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
              style={{ borderColor: "var(--color-line)" }}
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium invisible" aria-hidden="true">Export</label>
            <ExportButton
              filename="invoices"
              headers={["Invoice", ...(canManage ? ["Client"] : []), "Date", "Amount", "Balance", "Status"]}
              rows={filteredInvoices.map((inv) => [
                inv.invoice_number,
                ...(canManage ? [inv.profiles?.full_name ?? "—"] : []),
                new Date(inv.created_at).toLocaleDateString("en-IN"),
                Number(inv.total),
                balanceOf(inv),
                inv.status.replace("_", " "),
              ])}
            />
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
            itemLabel="invoices"
          />
        </div>

        <div className="overflow-x-auto">
        <table className="dt-table w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>#</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Invoice</th>
              {canManage && <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Client</th>}
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Date</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Amount</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Balance</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Status</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {pagedInvoices.map((inv, i) => {
              const style = STATUS_STYLE[inv.status];
              const balance = balanceOf(inv);
              return (
                <tr key={inv.id} style={{ borderColor: "var(--color-line)" }}>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{inv.invoice_number}</td>
                  {canManage && <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{inv.profiles?.full_name ?? "—"}</td>}
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{new Date(inv.created_at).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>₹{Number(inv.total).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3" style={{ color: balance > 0 ? "#b42318" : "var(--color-ink-soft)" }}>{balance > 0 ? `₹${balance.toLocaleString("en-IN")}` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>{inv.status.replace("_", " ")}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <a href={`/api/invoices/${inv.id}/download`} className="text-xs font-semibold underline" style={{ color: "var(--color-action-dark)" }}>PDF</a>
                      {canManage && inv.status !== "paid" && inv.status !== "cancelled" && (
                        <button type="button" onClick={() => { setPayingInvoice(inv); setPayAmount(String(balance)); }} className="text-xs font-semibold underline" style={{ color: "#116a2c" }}>
                          Record Payment
                        </button>
                      )}
                      {!canManage && inv.status !== "paid" && inv.status !== "cancelled" && (
                        <Link href={`/pay/${inv.id}`} target="_blank" className="text-xs font-semibold underline" style={{ color: "#116a2c" }}>
                          Pay Now
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredInvoices.length === 0 && (
              <tr>
                <td colSpan={canManage ? 8 : 7} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
                  {orderInvoices.length === 0 ? "No invoices yet." : "No invoices match this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
