"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isStaffOrAdmin, type Profile } from "@/lib/roles";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  created_at: string;
  profiles?: { full_name: string | null } | null;
};

type CustomerOption = { id: string; name: string };
type LineItemDraft = { description: string; quantity: string; unitPrice: string };

const STATUS_STYLE: Record<InvoiceRow["status"], { bg: string; fg: string }> = {
  draft: { bg: "var(--color-paper)", fg: "var(--color-ink-soft)" },
  sent: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  paid: { bg: "#d0f4db", fg: "#116a2c" },
  overdue: { bg: "#fde2e2", fg: "#b42318" },
  cancelled: { bg: "var(--color-paper)", fg: "var(--color-ink-soft)" },
};

const EMPTY_ITEM: LineItemDraft = { description: "", quantity: "1", unitPrice: "" };

export default function InvoicesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<LineItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [generating, setGenerating] = useState(false);

  async function loadInvoices(supabase: ReturnType<typeof createSupabaseBrowserClient>) {
    const { data } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, status, created_at, profiles!invoices_customer_id_fkey(full_name)")
      .order("created_at", { ascending: false });
    setInvoices((data as InvoiceRow[] | null) ?? []);
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

      await loadInvoices(supabase);

      if (p && isStaffOrAdmin(p)) {
        const { data: custs } = await supabase.from("profiles").select("id, full_name").eq("account_type", "customer");
        setCustomers(((custs ?? []) as { id: string; full_name: string | null }[]).map((c) => ({ id: c.id, name: c.full_name ?? "Unnamed" })));
      }
      setLoading(false);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  function updateItem(index: number, patch: Partial<LineItemDraft>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function handleMarkPaid(id: string) {
    const res = await fetch(`/api/invoices/${id}/mark-paid`, { method: "POST" });
    if (res.ok) {
      const supabase = createSupabaseBrowserClient();
      await loadInvoices(supabase);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return;
    setGenerating(true);
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        items: items
          .filter((i) => i.description && i.unitPrice)
          .map((i) => ({ description: i.description, quantity: Number(i.quantity) || 1, unitPrice: Number(i.unitPrice) })),
      }),
    });
    setGenerating(false);
    if (res.ok) {
      const supabase = createSupabaseBrowserClient();
      await loadInvoices(supabase);
      setItems([{ ...EMPTY_ITEM }]);
      setCustomerId("");
      setShowForm(false);
    }
  }

  const canManage = profile ? isStaffOrAdmin(profile) : false;

  if (loading) {
    return (
      <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
        Loading…
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
            Invoices
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
            {canManage ? "Generate and track invoices across customers." : "Invoices issued to your account."}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: "var(--color-ink-fixed)" }}
          >
            {showForm ? "Cancel" : "+ Generate Invoice"}
          </button>
        )}
      </div>

      {showForm && canManage && (
        <form
          onSubmit={handleGenerate}
          className="mt-5 space-y-3 rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]"
          style={{ borderColor: "var(--color-line)" }}
        >
          <select
            required
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
          >
            <option value="">Select a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {items.map((item, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_80px_120px]">
              <input
                required
                placeholder="Line item — e.g. GST Filing"
                value={item.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
                style={{ borderColor: "var(--color-line)" }}
              />
              <input
                type="number"
                min="1"
                placeholder="Qty"
                value={item.quantity}
                onChange={(e) => updateItem(i, { quantity: e.target.value })}
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
                style={{ borderColor: "var(--color-line)" }}
              />
              <input
                required
                type="number"
                min="0"
                placeholder="Unit ₹"
                value={item.unitPrice}
                onChange={(e) => updateItem(i, { unitPrice: e.target.value })}
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
                style={{ borderColor: "var(--color-line)" }}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])}
            className="text-sm font-medium"
            style={{ color: "var(--color-action-dark)" }}
          >
            + Add line item
          </button>

          <button
            type="submit"
            disabled={generating}
            className="w-full rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            {generating ? "Generating…" : "Generate Invoice"}
          </button>
        </form>
      )}

      <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Invoice</th>
              {canManage && <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Client</th>}
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Date</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Amount</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Status</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {invoices.map((inv) => {
              const style = STATUS_STYLE[inv.status];
              return (
                <tr key={inv.id} style={{ borderColor: "var(--color-line)" }}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{inv.invoice_number}</td>
                  {canManage && (
                    <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{inv.profiles?.full_name ?? "—"}</td>
                  )}
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
                    {new Date(inv.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>
                    ₹{Number(inv.total).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <a href={`/api/invoices/${inv.id}/download`} className="text-xs font-semibold underline" style={{ color: "var(--color-action-dark)" }}>
                        Download PDF
                      </a>
                      {canManage && inv.status !== "paid" && (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(inv.id)}
                          className="text-xs font-semibold underline"
                          style={{ color: "#116a2c" }}
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
                  No invoices yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
