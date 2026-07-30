"use client";

import { useState } from "react";
import { MOCK_INVOICES, type Invoice } from "@/lib/dashboard-data";
import { StateSelect } from "@/components/StateSelect";
import { CitySelect } from "@/components/CitySelect";

const STATUS_STYLE: Record<Invoice["status"], { bg: string; fg: string }> = {
  Paid: { bg: "#d0f4db", fg: "#116a2c" },
  Pending: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  Overdue: { bg: "#fde2e2", fg: "#b42318" },
};

let invoiceCounter = MOCK_INVOICES.length + 1045;

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(MOCK_INVOICES);
  const [showForm, setShowForm] = useState(false);
  const [selectedState, setSelectedState] = useState("");

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const label = String(data.get("item") ?? "Service");
    const amount = Number(data.get("amount") ?? 0);
    const invoice: Invoice = {
      id: `INV-${invoiceCounter++}`,
      client: String(data.get("client") ?? ""),
      billingCity: String(data.get("billingCity") ?? ""),
      billingState: String(data.get("billingState") ?? ""),
      date: new Date().toISOString().slice(0, 10),
      amount,
      status: "Pending",
      items: [{ label, amount }],
    };
    setInvoices((prev) => [invoice, ...prev]);
    form.reset();
    setSelectedState("");
    setShowForm(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
            Invoices
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-ink-soft)" }}>
            Generate and track invoices for your own clients.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          style={{ backgroundColor: "var(--color-ink-fixed)" }}
        >
          {showForm ? "Cancel" : "+ Create Invoice"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mt-5 grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2 dark:bg-[var(--color-paper-raised)]"
          style={{ borderColor: "var(--color-line)" }}
        >
          <input name="client" required placeholder="Client name" className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)] sm:col-span-2" style={{ borderColor: "var(--color-line)" }} />
          <StateSelect
            id="billingState"
            name="billingState"
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
          />
          <CitySelect
            key={selectedState}
            id="billingCity"
            name="billingCity"
            state={selectedState}
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
          />
          <input name="item" required placeholder="Line item — e.g. GST Filing" className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]" style={{ borderColor: "var(--color-line)" }} />
          <input name="amount" type="number" min="0" required placeholder="Amount (₹)" className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]" style={{ borderColor: "var(--color-line)" }} />
          <button
            type="submit"
            className="sm:col-span-2 rounded-full py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            Generate Invoice
          </button>
        </form>
      )}

      <div className="mt-5 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Invoice</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Client</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Date</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Amount</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {invoices.map((inv) => {
              const style = STATUS_STYLE[inv.status];
              return (
                <tr key={inv.id} style={{ borderColor: "var(--color-line)" }}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{inv.id}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
                    <div>{inv.client}</div>
                    {(inv.billingCity || inv.billingState) && (
                      <div className="text-xs" style={{ color: "var(--color-ink-soft)", opacity: 0.75 }}>
                        {[inv.billingCity, inv.billingState].filter(Boolean).join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{inv.date}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>₹{inv.amount.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
