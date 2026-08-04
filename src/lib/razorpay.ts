import crypto from "crypto";

// Talks to Razorpay's REST API directly over fetch rather than pulling in
// their SDK — the surface we need (create an order, verify two HMAC
// signatures) is small enough that a dependency isn't worth it.
const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

function getCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET env vars");
  }
  return { keyId, keySecret };
}

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
};

// amountInRupees is converted to paise here (Razorpay's base unit) so
// callers everywhere else in the app can keep working in rupees, matching
// how invoices/plans already store amounts.
export async function createRazorpayOrder(input: { amountInRupees: number; receipt: string; notes?: Record<string, string> }): Promise<RazorpayOrder> {
  const { keyId, keySecret } = getCredentials();
  const res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      amount: Math.round(input.amountInRupees * 100),
      currency: "INR",
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Razorpay order creation failed (${res.status}): ${body}`);
  }
  return res.json();
}

// Checkout success handler on the client hands back order id + payment id +
// signature — this confirms the payment actually belongs to the order we
// created and wasn't forged client-side (the signature is HMAC'd with the
// key secret, which the browser never sees).
export function verifyPaymentSignature(input: { orderId: string; paymentId: string; signature: string }): boolean {
  const { keySecret } = getCredentials();
  const expected = crypto.createHmac("sha256", keySecret).update(`${input.orderId}|${input.paymentId}`).digest("hex");
  return expected === input.signature;
}

// The webhook is the durable backstop for the client-side verify call above
// (which can be lost if the customer closes the tab right after paying) —
// verified against a separate webhook secret configured in the Razorpay
// dashboard, over the raw request body (not the parsed JSON, since
// re-serializing could change byte-for-byte content and break the HMAC).
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("Missing RAZORPAY_WEBHOOK_SECRET env var");
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return expected === signature;
}
