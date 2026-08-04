"use client";

import { useEffect, useState } from "react";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";

type CustomerOption = { id: string; name: string };

export default function BuyForCustomerPage() {
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [service, setService] = useState("");
  const [plan, setPlan] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; paymentUrl?: string } | null>(null);

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const res = await fetch("/api/customers");
      const data = await res.json();
      const custs = (data.customers ?? []) as { id: string; full_name: string | null }[];
      setCustomers(custs.map((c) => ({ id: c.id, name: c.full_name ?? "Unnamed" })));
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const res = await fetch("/api/orders/buy-for-customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, service, plan, price: Number(price) }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (res.ok) {
      setResult({
        ok: true,
        text: data.emailSent ? "Order created — payment request emailed to the customer." : "Order created, but the email failed to send — share the link manually.",
        paymentUrl: data.paymentUrl,
      });
      setService("");
      setPlan("");
      setPrice("");
      setCustomerId("");
    } else {
      setResult({ ok: false, text: data.error ?? "Failed to create order." });
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-sm font-medium mb-1";

  return (
    <div>
      <DashboardPageHero
        title="Buy a Plan for a Customer"
        subtitle="For a customer who called in or you're onboarding directly — this creates the order, generates a payment request link, and emails it to them."
      />
      <p className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}>
        No payment gateway is connected yet — the link shows the amount due and lets the customer contact us to pay. Mark it paid from the Invoices page once payment is confirmed.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4 rounded-2xl border bg-white p-6 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Customer</label>
            <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>
              Customer needs an account first — use Create User if they don&apos;t have one yet.
            </p>
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Service</label>
            <input required placeholder="e.g. Private Limited Company Registration" value={service} onChange={(e) => setService(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Plan</label>
            <input required placeholder="e.g. Standard" value={plan} onChange={(e) => setPlan(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Price (₹)</label>
            <input required type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
        </div>

        {result && (
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={result.ok ? { backgroundColor: "#d0f4db", color: "#116a2c" } : { backgroundColor: "#fde2e2", color: "#b42318" }}
          >
            <p>{result.text}</p>
            {result.paymentUrl && (
              <p className="mt-1 break-all">
                <a href={result.paymentUrl} target="_blank" rel="noopener noreferrer" className="underline">{result.paymentUrl}</a>
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: "var(--color-action)" }}
        >
          {submitting ? "Creating…" : "Create Order & Send Payment Link"}
        </button>
      </form>
    </div>
  );
}
