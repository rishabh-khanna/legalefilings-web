import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// Real click-through of the 7-step Invoice CRM wizard end to end: new
// customer -> place of supply -> one line item -> generate. Business
// Settings completeness is covered separately
// (business-settings-mandatory.spec.ts) — ensured here via a direct API
// call so this spec stays focused on the wizard itself.
test("admin generates a GST invoice for a brand-new customer through all 7 steps", async ({ page, request }) => {
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

  const suffix = Date.now();
  const customerEmail = `invoice-wizard-customer-${suffix}@example.com`;

  await page.goto("/dashboard/invoice-crm");
  await expect(page.getByRole("heading", { name: "Invoice CRM" })).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: "+ Generate Invoice" }).click();

  // The wizard is a fixed-position full-screen overlay — scope every
  // interaction below to it so an unrelated "Email"/"Next" etc. on the
  // page underneath (still in the DOM, just visually covered) can never
  // collide with the modal's own fields.
  const wizard = page.getByText("Generate Invoice", { exact: true }).locator("xpath=ancestor::div[contains(@class,'fixed')][1]");
  await expect(wizard).toBeVisible();

  // Step 1: Type — GST Invoice is the default selection, just confirm
  // and move on.
  await expect(wizard.getByRole("button", { name: "GST Invoice", exact: true })).toBeVisible();
  await wizard.getByRole("button", { name: "Next" }).click();

  // Step 2: Customer — create a brand-new one inline.
  await wizard.getByRole("button", { name: "+ Add New Customer" }).click();
  await wizard.locator("text=Customer Name").locator("xpath=following-sibling::input[1]").fill(`Invoice Wizard Customer ${suffix}`);
  await wizard.locator("text=Email").locator("xpath=following-sibling::input[1]").fill(customerEmail);
  await wizard.locator("select").filter({ hasText: "Select state" }).selectOption("Delhi");
  await wizard.getByPlaceholder("Billing Address").fill("123 Test Street, New Delhi");
  await wizard.getByRole("button", { name: "Add Customer" }).click();
  await expect(page.getByText("Customer added.", { exact: false })).toBeVisible({ timeout: 15000 });
  await wizard.getByRole("button", { name: "Next" }).click();

  // Step 3: Details — Place of Supply is required for a taxable (GST) invoice.
  await wizard.locator("text=Place of Supply").locator("xpath=following-sibling::input[1]").fill("Delhi");
  await wizard.getByRole("button", { name: "Next" }).click();

  // Step 4: Items — one manual line item.
  await wizard.getByPlaceholder("Description").fill("Playwright Test Consulting");
  await wizard.getByPlaceholder("Rate ₹").fill("5000");
  await wizard.getByRole("button", { name: "Next" }).click();

  // Step 5: Charges & TDS — leave defaults.
  await wizard.getByRole("button", { name: "Next" }).click();
  // Step 6: Terms & Notes — leave defaults.
  await wizard.getByRole("button", { name: "Next" }).click();

  // Step 7: Preview — confirm the totals reflect the item, then generate.
  await expect(wizard.getByText("Playwright Test Consulting", { exact: false })).toBeVisible();
  await expect(wizard.getByText("₹5,000", { exact: false }).first()).toBeVisible();

  await wizard.getByRole("button", { name: "Generate Invoice", exact: true }).click();
  await expect(page.getByText("Invoice generated.")).toBeVisible({ timeout: 15000 });

  // Every invoice row shows its own customer name inline (grouping was
  // replaced by the client filter dropdown — see invoice-crm/page.tsx's
  // invoiceClientFilter). Paginated with no search box on this page, so
  // bump rows-per-page to its max to guarantee this brand-new invoice is
  // actually rendered, not on another page.
  await page.locator("select").filter({ has: page.locator('option[value="100"]') }).selectOption("100");
  const row = page.locator("tr", { hasText: `Invoice Wizard Customer ${suffix}` });
  await expect(row).toBeVisible({ timeout: 10000 });
  // Invoice total is the item's rate plus 18% GST (₹5,000 -> ₹5,900),
  // not the raw taxable value.
  await expect(row.getByText("₹5,900", { exact: false }).first()).toBeVisible();
});

test("Invoice CRM's Recurring tab is reachable and lists templates without erroring", async ({ page }) => {
  await page.goto("/dashboard/invoice-crm");
  await expect(page.getByRole("heading", { name: "Invoice CRM" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Recurring", exact: true }).click();
  // Now the shared DataTable component — its empty state is a plain
  // <p>, not a row inside the table, so the table itself genuinely
  // doesn't exist when there are zero templates. Either is a valid,
  // non-erroring outcome.
  await expect(page.locator("table.dt-table").or(page.getByText("No recurring templates yet", { exact: false }))).toBeVisible({ timeout: 10000 });
});

test("a customer account with no invoice_crm grant is bounced away from Invoice CRM before the page ever loads", async ({ browser }) => {
  // proxy.ts gates this server-side now (a customer needs a live
  // invoice_crm grant, same mechanism as every other delegable admin
  // tool — see src/lib/tool-grants.ts) — a non-granted customer never
  // reaches the client-rendered "no access" state below, they're
  // redirected before the page loads at all.
  const customerCtx = await browser.newContext({ storageState: "tests/e2e/.auth/customerFree.json" });
  const page = await customerCtx.newPage();
  await page.goto("/dashboard/invoice-crm");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10000 });
  await customerCtx.close();
});
