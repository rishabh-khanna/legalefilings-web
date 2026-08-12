import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

async function ensureBusinessSettings(request: import("@playwright/test").APIRequestContext) {
  await request.patch("/api/business-settings", {
    data: {
      address: "Legal Efilings HQ, MG Road",
      gstNumber: "07AAAAA0000A1Z5",
      panNumber: "AAAAA0000A",
      state: "Delhi",
      stateCode: "07",
      bankName: "HDFC Bank",
      bankAccountNumber: "50100999888777",
      bankIfsc: "HDFC0001234",
    },
  });
}

// The manual "Run Now" trigger on a recurring invoice template — not
// covered before (invoice-crm-wizard.spec.ts only confirms the Recurring
// tab is reachable, never actually runs one). Creates a real template via
// the API, clicks "Run Now" in the real UI, and confirms a real Billed
// Invoice comes out the other end and next_run_date advances.
test("admin manually runs a recurring template and a real invoice is generated", async ({ page, request }) => {
  await ensureBusinessSettings(request);

  const suffix = Date.now();
  const description = `Playwright Recurring Service ${suffix}`;
  const startDate = new Date().toISOString().slice(0, 10);

  // A brand-new customer, not a reused seeded one — this suite reruns
  // against a persistent dev DB, and reusing customers[0] (as other
  // specs do) risks an ambiguous row match below against a leftover
  // never-run template from an earlier run sharing the same customer +
  // "today" next_run_date. A customer that has never existed before
  // guarantees this template is the only row that will ever match it.
  const customerEmail = `recurring-run-now-${suffix}@example.com`;
  await page.goto("/dashboard/invoice-crm");
  await expect(page.getByRole("heading", { name: "Invoice Generator" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "+ Generate Invoice" }).click();
  const setupWizard = page.getByText("Generate Invoice", { exact: true }).locator("xpath=ancestor::div[contains(@class,'fixed')][1]");
  await expect(setupWizard).toBeVisible();
  await setupWizard.getByRole("button", { name: "Next" }).click(); // Step 1 -> 2
  await setupWizard.getByRole("button", { name: "+ Add New Customer" }).click();
  await setupWizard.locator("text=Customer Name").locator("xpath=following-sibling::input[1]").fill(`Recurring Run Now Customer ${suffix}`);
  await setupWizard.locator("text=Email").locator("xpath=following-sibling::input[1]").fill(customerEmail);
  await setupWizard.locator("select").filter({ hasText: "Select state" }).selectOption("Delhi");
  await setupWizard.getByPlaceholder("Billing Address").fill("Test Address");
  await setupWizard.getByRole("button", { name: "Add Customer" }).click();
  await expect(page.getByText("Customer added.", { exact: false })).toBeVisible({ timeout: 15000 });
  const closeButton = setupWizard.locator('[aria-label="Close"]');
  if (await closeButton.first().isVisible().catch(() => false)) await closeButton.first().click();

  const customersRes = await request.get("/api/customers");
  const { customers } = await customersRes.json();
  // full_name isn't unique enough by itself if this test's ever re-run
  // the same millisecond twice — but combined with the fresh email above
  // it's not needed for lookup here; matched via full_name since
  // /api/customers doesn't return email.
  const customer = customers.find((c: { full_name: string | null }) => c.full_name === `Recurring Run Now Customer ${suffix}`);
  if (!customer) throw new Error("Newly created customer not found via /api/customers");

  const templateRes = await request.post("/api/recurring-invoices", {
    data: {
      customerId: customer.id,
      invoiceType: "gst",
      frequency: "monthly",
      startDate,
      payload: {
        customerId: customer.id,
        invoiceType: "gst",
        placeOfSupply: customer.state ?? "Delhi",
        items: [{ description, quantity: 1, rate: 3000 }],
      },
    },
  });
  expect(templateRes.ok()).toBeTruthy();
  const { template } = await templateRes.json();
  expect(template.next_run_date).toBe(startDate);

  await page.goto("/dashboard/invoice-crm");
  await expect(page.getByRole("heading", { name: "Invoice Generator" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Recurring", exact: true }).click();

  const templateRow = page.locator("tr", { hasText: customer.full_name ?? customer.company ?? "" }).first();
  await expect(templateRow).toBeVisible({ timeout: 10000 });

  await templateRow.getByRole("button", { name: "Run Now" }).click();
  await expect(page.getByText("Running…")).toHaveCount(0, { timeout: 15000 });

  // next_run_date must have advanced past today (monthly frequency) — the
  // real signal a genuine generation ran, not just a UI click.
  const after = await request.get(`/api/recurring-invoices`).then((r) => r.json());
  const updated = after.templates.find((t: { id: string }) => t.id === template.id);
  expect(updated).toBeTruthy();
  expect(updated.next_run_date > startDate).toBe(true);
  expect(updated.last_generated_invoice_id).toBeTruthy();

  // The generated invoice is real and shows up in the main Invoices list.
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await page.locator("select").filter({ has: page.locator('option[value="100"]') }).selectOption("100");
  const groupHeader = page.locator("tr", { hasText: customer.full_name ?? customer.company ?? "" }).first();
  await expect(groupHeader).toBeVisible({ timeout: 10000 });
});

test("a customer account is blocked from manually running a recurring template", async ({ browser, request }) => {
  const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
  const customersRes = await adminCtx.request.get("/api/customers");
  const { customers } = await customersRes.json();
  const customer = customers[0];

  const templateRes = await adminCtx.request.post("/api/recurring-invoices", {
    data: {
      customerId: customer.id,
      invoiceType: "gst",
      frequency: "monthly",
      startDate: new Date().toISOString().slice(0, 10),
      payload: {
        customerId: customer.id,
        invoiceType: "gst",
        placeOfSupply: customer.state ?? "Delhi",
        items: [{ description: "Blocked-run test item", quantity: 1, rate: 1000 }],
      },
    },
  });
  const { template } = await templateRes.json();
  await adminCtx.close();

  const customerCtx = await browser.newContext({ storageState: "tests/e2e/.auth/customerFree.json" });
  const res = await customerCtx.request.get(`/api/recurring-invoices/run?templateId=${template.id}`);
  expect(res.status()).toBe(403);
  await customerCtx.close();
  void request;
});
