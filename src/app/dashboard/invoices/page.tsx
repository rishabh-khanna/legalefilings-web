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
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { MultiSelect } from "@/components/MultiSelect";
import { SearchButton } from "@/components/SearchButton";
import { isCollectableInvoiceType } from "@/lib/invoice-calc";

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
  organization_id: string;
  profiles?: { full_name: string | null; company: string | null } | null;
  invoice_payments?: { amount: number }[];
  organizations?: { name: string | null } | null;
  creator?: { full_name: string | null } | null;
};

const STATUS_STYLE: Record<InvoiceRow["status"], { bg: string; fg: string }> = {
  draft: { bg: "var(--color-paper)", fg: "var(--color-ink-soft)" },
  sent: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  paid: { bg: "var(--color-success-tint)", fg: "var(--color-success)" },
  partially_paid: { bg: "var(--color-action-tint)", fg: "var(--color-action-dark)" },
  overdue: { bg: "var(--color-danger-tint)", fg: "var(--color-danger)" },
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

  const [draftStatusFilter, setDraftStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
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
    () => (statusFilter.size === 0 ? orderInvoices : orderInvoices.filter((i) => statusFilter.has(i.status))),
    [orderInvoices, statusFilter]
  );

  // Replaces the old group-by-client clustering (canManage only — a
  // customer's own invoice list was never grouped, it's already just
  // theirs) with one dropdown to narrow the table to a single client
  // instead of the whole list visually reorganized around them.
  const [draftClientFilter, setDraftClientFilter] = useState<Set<string>>(new Set());
  const [clientFilter, setClientFilter] = useState<Set<string>>(new Set());
  const invoiceFiltersDirty =
    draftStatusFilter.size !== statusFilter.size || [...draftStatusFilter].some((v) => !statusFilter.has(v)) ||
    draftClientFilter.size !== clientFilter.size || [...draftClientFilter].some((v) => !clientFilter.has(v));
  const clientOptions = useMemo(() => {
    if (!canManage) return [];
    const byId = new Map<string, string>();
    for (const inv of orderInvoices) {
      if (!byId.has(inv.customer_id)) byId.set(inv.customer_id, inv.profiles?.full_name ?? "—");
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [orderInvoices, canManage]);
  const clientFilteredInvoices = useMemo(
    () => (clientFilter.size === 0 ? statusFilteredInvoices : statusFilteredInvoices.filter((i) => clientFilter.has(i.customer_id))),
    [statusFilteredInvoices, clientFilter]
  );

  const invoicesByStatus = useMemo(() => {
    const paid = orderInvoices.filter((i) => i.status === "paid");
    const pending = orderInvoices.filter((i) => i.status !== "paid");
    const totalValue = orderInvoices.filter((i) => i.status !== "cancelled").reduce((sum, i) => sum + Number(i.total), 0);
    return { paid, pending, totalValue };
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
    // A credit note is money owed TO the customer and a proforma is a
    // quotation — neither is a receivable, so neither carries an
    // outstanding balance to display or collect.
    if (!isCollectableInvoiceType(inv.invoice_type)) return 0;
    const paid = (inv.invoice_payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    return Math.max(0, Number(inv.total) - paid);
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  // Only a platform_admin's request ever returns more than one org's
  // invoices pooled together — the column is only worth showing once
  // it's actually ambiguous which org a row belongs to.
  const spansMultipleOrgs = new Set(orderInvoices.map((i) => i.organization_id)).size > 1;

  const invoiceColumns: DataTableColumn<InvoiceRow>[] = [
    { key: "invoice", header: "Invoice", className: "w-[10%] whitespace-nowrap", render: (inv) => <span className="font-medium" style={{ color: "var(--color-ink)" }}>{inv.invoice_number}</span>, exportValue: (inv) => inv.invoice_number, sortValue: (inv) => inv.invoice_number },
    ...(canManage
      ? [{ key: "client", header: "Client", className: "whitespace-nowrap", render: (inv: InvoiceRow) => inv.profiles?.full_name ?? "—", exportValue: (inv: InvoiceRow) => inv.profiles?.full_name ?? "—", sortValue: (inv: InvoiceRow) => inv.profiles?.full_name } as DataTableColumn<InvoiceRow>]
      : []),
    { key: "date", header: "Date", className: "w-[9%] whitespace-nowrap", render: (inv) => new Date(inv.created_at).toLocaleDateString("en-IN"), exportValue: (inv) => new Date(inv.created_at).toLocaleDateString("en-IN"), sortValue: (inv) => inv.created_at },
    { key: "amount", header: "Amount", className: "w-[10%] whitespace-nowrap", render: (inv) => <span className="font-semibold" style={{ color: "var(--color-ink)" }}>₹{Number(inv.total).toLocaleString("en-IN")}</span>, exportValue: (inv) => Number(inv.total), sortValue: (inv) => Number(inv.total) },
    {
      key: "balance",
      header: "Balance",
      className: "w-[10%] whitespace-nowrap",
      render: (inv) => {
        const balance = balanceOf(inv);
        return <span style={{ color: balance > 0 ? "var(--color-danger)" : "var(--color-ink-soft)" }}>{balance > 0 ? `₹${balance.toLocaleString("en-IN")}` : "—"}</span>;
      },
      exportValue: (inv) => balanceOf(inv),
      sortValue: (inv) => balanceOf(inv),
    },
    {
      key: "status",
      header: "Status",
      className: "w-[8%] whitespace-nowrap",
      render: (inv) => (
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: STATUS_STYLE[inv.status].bg, color: STATUS_STYLE[inv.status].fg }}>{inv.status.replace("_", " ")}</span>
      ),
      exportValue: (inv) => inv.status.replace("_", " "),
      sortValue: (inv) => inv.status,
    },
    ...(canManage
      ? [{ key: "createdBy", header: "Created By", className: "w-[11%] whitespace-nowrap", render: (inv: InvoiceRow) => inv.creator?.full_name ?? "—", exportValue: (inv: InvoiceRow) => inv.creator?.full_name ?? "", sortValue: (inv: InvoiceRow) => inv.creator?.full_name } as DataTableColumn<InvoiceRow>]
      : []),
    ...(spansMultipleOrgs
      ? [{ key: "org", header: "Organization", className: "w-[10%] whitespace-nowrap", render: (inv: InvoiceRow) => inv.organizations?.name ?? "—", exportValue: (inv: InvoiceRow) => inv.organizations?.name ?? "Unknown organization" } as DataTableColumn<InvoiceRow>]
      : []),
    {
      key: "actions",
      header: "Action",
      className: "w-[12%]",
      render: (inv) => {
        const balance = balanceOf(inv);
        return (
          <div className="flex flex-wrap items-center gap-2.5">
            <a href={`/api/invoices/${inv.id}/download`} className="text-xs font-semibold underline" style={{ color: "var(--color-action-dark)" }}>PDF</a>
            {canManage && isCollectableInvoiceType(inv.invoice_type) && inv.status !== "paid" && inv.status !== "cancelled" && (
              <button type="button" onClick={() => { setPayingInvoice(inv); setPayAmount(String(balance)); }} className="text-xs font-semibold underline" style={{ color: "var(--color-success)" }}>
                Record Payment
              </button>
            )}
            {!canManage && isCollectableInvoiceType(inv.invoice_type) && inv.status !== "paid" && inv.status !== "cancelled" && (
              <Link href={`/pay/${inv.id}`} target="_blank" className="text-xs font-semibold underline" style={{ color: "var(--color-success)" }}>
                Pay Now
              </Link>
            )}
          </div>
        );
      },
    },
  ];

  if (loading) {
    return <LoadingBlock />;
  }

  return (
    <div>
      <DashboardPageHero
        title={canManage ? "Order Invoices" : "My Invoices"}
        subtitle={
          spansMultipleOrgs
            ? "Every organization's order invoices, pooled here for platform-level support."
            : canManage
              ? "Invoices generated from purchases — Buy Plan for Customer and direct checkout. For ad-hoc billing, use Invoice Generator."
              : "Invoices issued to your account."
        }
      >
        <div className="relative mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <HeroKpi icon={FileText} label="Total" value={orderInvoices.length} />
          <HeroKpi icon={CheckCircle2} label="Paid" value={invoicesByStatus.paid.length} />
          <HeroKpi icon={Clock} label="Pending" value={invoicesByStatus.pending.length} />
          <HeroKpi icon={IndianRupee} label="Total Value" value={`₹${invoicesByStatus.totalValue.toLocaleString("en-IN")}`} />
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

      <DataTable
        columns={invoiceColumns}
        fixedLayout
        rows={clientFilteredInvoices}
        getRowKey={(inv) => inv.id}
        itemLabel="invoices"
        emptyMessage="No invoices yet."
        filteredEmptyMessage="No invoices match this filter."
        search={{
          placeholder: "Search invoice number, client…",
          filter: (inv, q) => `${inv.invoice_number} ${inv.profiles?.full_name ?? ""} ${inv.profiles?.company ?? ""}`.toLowerCase().includes(q),
        }}
        dateFilter={{ getDate: (inv) => inv.created_at }}
        exportFilename="invoices"
        minWidth={640}
        toolbar={
          <>
            <MultiSelect
              options={[
                { value: "draft", label: "Draft" },
                { value: "sent", label: "Sent" },
                { value: "paid", label: "Paid" },
                { value: "partially_paid", label: "Partially Paid" },
                { value: "overdue", label: "Overdue" },
                { value: "cancelled", label: "Cancelled" },
              ]}
              selected={draftStatusFilter}
              onChange={setDraftStatusFilter}
              placeholder="All statuses"
            />
            {canManage && (
              <MultiSelect
                options={clientOptions.map(([id, name]) => ({ value: id, label: name }))}
                selected={draftClientFilter}
                onChange={setDraftClientFilter}
                placeholder="All clients"
                searchable
              />
            )}
            <SearchButton
              onClick={() => {
                setStatusFilter(draftStatusFilter);
                setClientFilter(draftClientFilter);
              }}
              dirty={invoiceFiltersDirty}
            />
          </>
        }
      />
    </div>
  );
}
