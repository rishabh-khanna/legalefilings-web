"use client";

import { useState } from "react";
import { loadRazorpayScript } from "@/lib/load-razorpay";
import { SITE_NAME } from "@/config/site";

export function PayNowButton({
  invoiceId,
  customerName,
  customerEmail,
}: {
  invoiceId: string;
  customerName: string;
  customerEmail: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handlePay() {
    setStatus("loading");
    setErrorMsg(null);
    try {
      await loadRazorpayScript();
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        // The invoice's real status just changed underneath this page
        // (already paid/cancelled, or create-order just caught up a
        // payment that hadn't been recorded yet) — reload instead of
        // just showing an error, so the customer sees the actual
        // current status rather than a confusing error message sitting
        // on top of a stale "Awaiting Payment" screen.
        if (data.shouldReload) {
          window.location.reload();
          return;
        }
        throw new Error(data.error ?? "Failed to start payment");
      }

      if (!window.Razorpay) throw new Error("Payment gateway failed to load");
      const razorpay = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: SITE_NAME,
        description: `Invoice ${data.invoiceNumber}`,
        order_id: data.orderId,
        prefill: { name: customerName, email: customerEmail },
        theme: { color: "var(--color-accent)" },
        handler: async (response) => {
          try {
            const verifyRes = await fetch("/api/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ invoiceId, ...response }),
            });
            if (!verifyRes.ok) throw new Error("Payment verification failed");
            setStatus("success");
            window.location.reload();
          } catch (err) {
            setStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "Payment verification failed");
          }
        },
        modal: { ondismiss: () => setStatus("idle") },
      });
      razorpay.open();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handlePay}
        disabled={status === "loading"}
        className="w-full rounded-full py-3 text-center text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
        style={{ backgroundColor: "var(--color-action)" }}
      >
        {status === "loading" ? "Opening secure checkout…" : "Pay Now"}
      </button>
      {status === "error" && errorMsg && (
        <p className="mt-2 text-center text-sm text-red-600">{errorMsg}</p>
      )}
    </div>
  );
}
