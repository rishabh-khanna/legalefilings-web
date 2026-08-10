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

async function createOriginalInvoice(request: import("@playwright/test").APIRequestContext) {
  const customersRes = await request.get("/api/customers");
  const { customers } = await customersRes.json();
  const customer = customers[0];
  if (!customer) throw new Error("No customer accounts found to seed an original invoice against");

  const res = await request.post("/api/invoices", {
    data: {
      customerId: customer.id,
      invoiceType: "gst",
      placeOfSupply: customer.state ?? "Delhi",
      items: [{ description: `Original Service ${Date.now()}`, quantity: 1, rate: 10000 }],
    },
  });
  if (!res.ok()) throw new Error(`create original invoice failed: ${await res.text()}`);
  const { invoice } = await res.json();
  return { customer, invoice: invoice as { id: string; invoice_number: string; total: number } };
}

// Credit/Debit Notes were entirely uncovered — real UI click-through for
// each, against a real original invoice, confirming the note is issued
// to the SAME customer as the original (the page deliberately forbids
// re-picking a customer for a note — see invoice-crm/page.tsx) and its
// total shows up correctly grouped.
test("admin issues a Credit Note against a real invoice through the wizard", async ({ page, request }) => {
  await ensureBusinessSettings(request);
  const { customer, invoice } = await createOriginalInvoice(request);

  await page.goto("/dashboard/invoice-crm");
  await expect(page.getByRole("heading", { name: "Invoice CRM" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "+ Generate Invoice" }).click();

  const wizard = page.getByText("Generate Invoice", { exact: true }).locator("xpath=ancestor::div[contains(@class,'fixed')][1]");
  await expect(wizard).toBeVisible();

  // Step 1: Type — Credit Note, then pick the original invoice.
  await wizard.getByRole("button", { name: "Credit Note", exact: true }).click();
  await wizard.locator("select").filter({ hasText: "Select the original invoice" }).selectOption({ label: new RegExp(invoice.invoice_number) });
  await wizard.getByRole("button", { name: "Next" }).click();

  // Step 2: Customer — locked to the original invoice's customer, no
  // picker shown.
  await expect(wizard.getByText("Customer (from the selected invoice)", { exact: false })).toBeVisible();
  await expect(wizard.getByText(customer.full_name ?? customer.company ?? "", { exact: false })).toBeVisible();
  await wizard.getByRole("button", { name: "Next" }).click();

  // Step 3: Details.
  await wizard.locator("text=Place of Supply").locator("xpath=following-sibling::input[1]").fill(customer.state ?? "Delhi");
  await wizard.getByRole("button", { name: "Next" }).click();

  // Step 4: Items — the amount being credited back.
  await wizard.getByPlaceholder("Description").fill("Refund — service not rendered");
  await wizard.getByPlaceholder("Rate ₹").fill("2000");
  await wizard.getByRole("button", { name: "Next" }).click();

  await wizard.getByRole("button", { name: "Next" }).click(); // Charges & TDS
  await wizard.getByRole("button", { name: "Next" }).click(); // Terms & Notes

  // Step 7: Preview — confirm this reads as a Credit Note, not a plain invoice.
  await expect(wizard.getByText("Credit Note", { exact: false }).first()).toBeVisible();
  await wizard.getByRole("button", { name: "Generate Invoice", exact: true }).click();
  await expect(page.getByText("Invoice generated.")).toBeVisible({ timeout: 15000 });

  await page.locator("select").filter({ has: page.locator('option[value="100"]') }).selectOption("100");
  const groupHeader = page.locator("tr", { hasText: customer.full_name ?? customer.company ?? "" }).first();
  await expect(groupHeader).toBeVisible({ timeout: 10000 });
});

test("admin issues a Debit Note against a real invoice through the wizard", async ({ page, request }) => {
  await ensureBusinessSettings(request);
  const { customer, invoice } = await createOriginalInvoice(request);

  await page.goto("/dashboard/invoice-crm");
  await expect(page.getByRole("heading", { name: "Invoice CRM" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "+ Generate Invoice" }).click();

  const wizard = page.getByText("Generate Invoice", { exact: true }).locator("xpath=ancestor::div[contains(@class,'fixed')][1]");
  await expect(wizard).toBeVisible();

  await wizard.getByRole("button", { name: "Debit Note", exact: true }).click();
  await wizard.locator("select").filter({ hasText: "Select the original invoice" }).selectOption({ label: new RegExp(invoice.invoice_number) });
  await wizard.getByRole("button", { name: "Next" }).click();

  await expect(wizard.getByText("Customer (from the selected invoice)", { exact: false })).toBeVisible();
  await wizard.getByRole("button", { name: "Next" }).click();

  await wizard.locator("text=Place of Supply").locator("xpath=following-sibling::input[1]").fill(customer.state ?? "Delhi");
  await wizard.getByRole("button", { name: "Next" }).click();

  await wizard.getByPlaceholder("Description").fill("Additional charges — extra filing fee");
  await wizard.getByPlaceholder("Rate ₹").fill("1500");
  await wizard.getByRole("button", { name: "Next" }).click();
  await wizard.getByRole("button", { name: "Next" }).click();
  await wizard.getByRole("button", { name: "Next" }).click();

  await expect(wizard.getByText("Debit Note", { exact: false }).first()).toBeVisible();
  await wizard.getByRole("button", { name: "Generate Invoice", exact: true }).click();
  await expect(page.getByText("Invoice generated.")).toBeVisible({ timeout: 15000 });
});

test("a Credit Note can't be generated without picking the original invoice first", async ({ page, request }) => {
  await ensureBusinessSettings(request);

  await page.goto("/dashboard/invoice-crm");
  await expect(page.getByRole("heading", { name: "Invoice CRM" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "+ Generate Invoice" }).click();

  const wizard = page.getByText("Generate Invoice", { exact: true }).locator("xpath=ancestor::div[contains(@class,'fixed')][1]");
  await expect(wizard).toBeVisible();

  await wizard.getByRole("button", { name: "Credit Note", exact: true }).click();
  await wizard.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Pick the original invoice this note is issued against.", { exact: false })).toBeVisible({ timeout: 5000 });
});
