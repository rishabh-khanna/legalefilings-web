"use client";

import { useEffect, useState } from "react";
import { PAYMENT_MODAL_EVENT, type PaymentModalDetail } from "@/lib/payment-modal";
import { loadRazorpayScript } from "@/lib/load-razorpay";
import { SITE_NAME } from "@/config/site";

// ₹1,999 / ₹4,999+ / ₹4,999 per month → 1999 / 4999 / 4999 — strips the
// currency symbol, thousands separators, and any trailing "+"/period
// qualifier the pricing copy tacks on (govt. fee notes, "/mo" etc.).
function parsePrice(price: string): number {
  const digits = price.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

type Status = "form" | "submitting" | "error";

export function PaymentModal() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<PaymentModalDetail | null>(null);
  const [status, setStatus] = useState<Status>("form");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      setDetail((e as CustomEvent<PaymentModalDetail>).detail);
      setStatus("form");
      setErrorMsg(null);
      setOpen(true);
    };
    window.addEventListener(PAYMENT_MODAL_EVENT, handler);
    return () => window.removeEventListener(PAYMENT_MODAL_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || !detail) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!detail) return;
    setStatus("submitting");
    setErrorMsg(null);

    const form = e.currentTarget;
    const data = new FormData(form);
    const fullName = String(data.get("name"));
    const email = String(data.get("email"));
    const phone = `+91${data.get("phone")}`;

    try {
      await loadRazorpayScript();
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          service: detail.service,
          plan: detail.plan.name,
          price: parsePrice(detail.plan.price),
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to start payment");

      if (!window.Razorpay) throw new Error("Payment gateway failed to load");
      const razorpay = new window.Razorpay({
        key: payload.keyId,
        amount: payload.amount,
        currency: payload.currency,
        name: SITE_NAME,
        description: `${detail.service} — ${detail.plan.name}`,
        order_id: payload.orderId,
        prefill: { name: fullName, email, contact: phone },
        theme: { color: "#fdc500" },
        handler: async (response) => {
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ invoiceId: payload.invoiceId, ...response }),
            });
            if (!verifyRes.ok) throw new Error("Payment verification failed");
            window.location.href = `/pay/${payload.invoiceId}`;
          } catch (err) {
            setStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "Payment verification failed");
          }
        },
        modal: { ondismiss: () => setStatus("form") },
      });
      razorpay.open();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-[var(--color-action)]";
  const inputStyle = { borderColor: "var(--color-line)" };
  const labelClass = "block text-sm font-medium mb-1";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8 sm:items-center"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-xl bg-white dark:bg-[var(--color-paper-raised)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none hover:bg-black/5"
          style={{ color: "var(--color-ink-soft)" }}
        >
          &times;
        </button>

        <form onSubmit={handleSubmit} className="rounded-xl border p-5 space-y-3" style={{ borderColor: "var(--color-line)" }}>
          <div>
            <h3 className="font-semibold text-lg" style={{ fontFamily: "var(--font-display)", color: "var(--color-ink)" }}>
              Pay for {detail.service}
            </h3>
            <span
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: "var(--color-action-tint)", color: "var(--color-action-dark)" }}
            >
              {detail.plan.name} — {detail.plan.price}
            </span>
            <p className="mt-2 text-xs" style={{ color: "var(--color-ink-soft)" }}>
              We&apos;ll create your account (if you don&apos;t have one) and take you straight to secure checkout.
            </p>
          </div>
          <div>
            <label htmlFor="pay-name" className={labelClass} style={{ color: "var(--color-ink)" }}>
              Name
            </label>
            <input id="pay-name" name="name" required className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label htmlFor="pay-email" className={labelClass} style={{ color: "var(--color-ink)" }}>
              Email
            </label>
            <input id="pay-email" name="email" type="email" required className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label htmlFor="pay-phone" className={labelClass} style={{ color: "var(--color-ink)" }}>
              Contact Number
            </label>
            <div className="flex">
              <span
                className="flex items-center rounded-l-lg border border-r-0 px-3 text-sm"
                style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)", backgroundColor: "var(--color-paper)" }}
              >
                +91
              </span>
              <input
                id="pay-phone"
                name="phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                required
                className={`${inputClass} rounded-l-none`}
                style={inputStyle}
              />
            </div>
          </div>

          {status === "error" && errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="w-full rounded-full text-white text-sm font-semibold py-2.5 transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            {status === "submitting" ? "Opening secure checkout…" : "Continue to Payment"}
          </button>
        </form>
      </div>
    </div>
  );
}
