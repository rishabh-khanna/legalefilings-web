import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// "Additional GST Registrations" on the Business Settings page — for an
// org operating under more than one GSTIN (e.g. a branch in another
// state). Add one through the real UI, confirm it shows up as a
// selectable registration in the Invoice CRM wizard, then remove it.
test("admin adds, uses, and removes an additional GST registration", async ({ page }) => {
  const suffix = Date.now();
  const label = `Playwright Branch ${suffix}`;
  const gstNumber = `29AAAAA${String(suffix).slice(-4)}A1Z${suffix % 10}`;

  await page.goto("/dashboard/admin/business-settings");
  await expect(page.getByRole("heading", { name: "Business Settings" })).toBeVisible({ timeout: 15000 });

  await expect(page.getByText("Additional GST Registrations")).toBeVisible();
  // Scoped to the Additional Registration form specifically — the main
  // Business Settings form above it has its own #state select too (same
  // StateSelect component, duplicate id), so an unscoped "select" lookup
  // is ambiguous.
  const regForm = page.locator("form").filter({ has: page.getByPlaceholder("Label (e.g. Delhi Office)") });
  await regForm.getByPlaceholder("Label (e.g. Delhi Office)").fill(label);
  await regForm.getByPlaceholder("GST Number").fill(gstNumber);
  await regForm.locator("select").selectOption("Karnataka");
  await regForm.getByRole("button", { name: "+ Add Registration" }).click();

  const row = page.locator("div", { hasText: label }).filter({ has: page.getByRole("button", { name: "Remove" }) }).last();
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect(row).toContainText(gstNumber);

  // The new registration must actually be usable — Invoice CRM's own
  // registration picker (step "Details") reads from the same API this
  // page just wrote to.
  await page.goto("/dashboard/invoice-crm");
  await expect(page.getByRole("heading", { name: "Invoice CRM" })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "+ Generate Invoice" }).click();
  const wizard = page.getByText("Generate Invoice", { exact: true }).locator("xpath=ancestor::div[contains(@class,'fixed')][1]");
  await expect(wizard).toBeVisible();
  await wizard.getByRole("button", { name: "Next" }).click(); // Step 1 -> 2
  await wizard.getByRole("button", { name: "+ Add New Customer" }).click();
  await wizard.locator("text=Customer Name").locator("xpath=following-sibling::input[1]").fill(`GST Reg Test Customer ${suffix}`);
  await wizard.locator("text=Email").locator("xpath=following-sibling::input[1]").fill(`gst-reg-test-${suffix}@example.com`);
  await wizard.locator("select").filter({ hasText: "Select state" }).selectOption("Delhi");
  await wizard.getByPlaceholder("Billing Address").fill("Test Address");
  await wizard.getByRole("button", { name: "Add Customer" }).click();
  await expect(page.getByText("Customer added.", { exact: false })).toBeVisible({ timeout: 15000 });
  await wizard.getByRole("button", { name: "Next" }).click(); // -> Step 3 Details

  const regSelect = wizard.locator("select").filter({ has: page.locator(`option:has-text("${label}")`) });
  await expect(regSelect).toBeVisible({ timeout: 10000 });
  const regOptionValue = await regSelect.locator(`option:has-text("${label}")`).getAttribute("value");
  await regSelect.selectOption(regOptionValue!);

  // Close the wizard without generating — this test only needs to prove
  // the registration is selectable, not create another invoice.
  await page.keyboard.press("Escape").catch(() => {});
  const closeButton = wizard.getByRole("button", { name: "×" }).or(wizard.locator('[aria-label="Close"]'));
  if (await closeButton.first().isVisible().catch(() => false)) await closeButton.first().click();

  // Clean up — remove the registration through the real UI too.
  await page.goto("/dashboard/admin/business-settings");
  await expect(page.getByRole("heading", { name: "Business Settings" })).toBeVisible({ timeout: 15000 });
  page.once("dialog", (dialog) => dialog.accept());
  const cleanupRow = page.locator("div", { hasText: label }).filter({ has: page.getByRole("button", { name: "Remove" }) }).last();
  await cleanupRow.getByRole("button", { name: "Remove" }).click();
  await expect(page.locator("div", { hasText: gstNumber })).toHaveCount(0, { timeout: 10000 });
});

test("a customer account is bounced away from Business Settings", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/customerFree.json" });
  const page = await ctx.newPage();
  await page.goto("/dashboard/admin/business-settings");
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10000 });
  await ctx.close();
});
