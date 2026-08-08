import type { APIRequestContext } from "@playwright/test";

// Creates a fresh order+invoice for the seeded free customer via the
// real "Buy Plan for Customer" API — the same path staff use — so
// payment specs always test against a brand-new, never-touched invoice
// instead of mutating shared seeded data other specs might also rely on.
export async function seedUnpaidInvoice(request: APIRequestContext, opts?: { price?: number }) {
  const customersRes = await request.get("/api/customers");
  if (!customersRes.ok()) throw new Error(`GET /api/customers failed: ${await customersRes.text()}`);
  const { customers } = await customersRes.json();
  const customer = customers[0];
  if (!customer) throw new Error("No customer accounts found to seed a test invoice against");

  const price = opts?.price ?? 1999;
  const buyRes = await request.post("/api/orders/buy-for-customer", {
    data: { customerId: customer.id, service: "GST Registration", plan: `Playwright Test ${Date.now()}`, price },
  });
  if (!buyRes.ok()) throw new Error(`buy-for-customer failed: ${await buyRes.text()}`);
  const { order, invoice } = await buyRes.json();
  return { customer, order, invoice: invoice as { id: string; invoice_number: string; total: number; status: string } };
}
