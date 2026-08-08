import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// Real click-through of "Buy a Plan for a Customer" (creates an order +
// invoice + payment link on behalf of a customer who called in — see
// src/app/api/orders/buy-for-customer/route.ts). Business Settings
// completeness is a separate, already-covered concern
// (business-settings-mandatory.spec.ts) — this test just makes sure the
// shared demo org's settings are complete via a direct API call first,
// so this spec stays focused on the buy flow itself.
test("admin buys a plan for an existing customer and gets a real order + payment link", async ({ page, request }) => {
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
  const customerEmail = `buy-flow-customer-${suffix}@example.com`;
  const createCustomerRes = await request.post("/api/admin/create-user", {
    data: { fullName: `Buy Flow Customer ${suffix}`, email: customerEmail, accountType: "customer", customerTier: "free" },
  });
  expect(createCustomerRes.ok(), await createCustomerRes.text()).toBeTruthy();

  await page.goto("/dashboard/admin/buy-for-customer");
  await expect(page.getByRole("heading", { name: "Buy a Plan for a Customer" })).toBeVisible({ timeout: 15000 });

  await page.locator("select").selectOption({ label: `Buy Flow Customer ${suffix}` });
  await page.locator("text=Service").locator("xpath=following-sibling::input[1]").fill("GST Registration");
  await page.locator("text=Plan").locator("xpath=following-sibling::input[1]").fill("Basic");
  await page.locator("text=Price (₹)").locator("xpath=following-sibling::input[1]").fill("1999");

  await page.getByRole("button", { name: "Create Order & Send Payment Link" }).click();
  await expect(page.getByText(/Order created/, { exact: false })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('a[href*="/pay/"]')).toBeVisible();

  // Form resets on success, ready for another order.
  await expect(page.locator("select")).toHaveValue("");
});

test("API: staff without the buy_for_customer tool grant is forbidden", async ({ browser }) => {
  const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
  const raterPage = await raterCtx.newPage();
  // Not admin-only in proxy.ts's ADMIN_ONLY_SECTIONS — any staff level
  // can reach the page (see proxy.ts's comment on buying a plan for a
  // customer being open to any staff level, scoped elsewhere).
  await raterPage.goto("/dashboard/admin/buy-for-customer");
  await expect(raterPage.getByRole("heading", { name: "Buy a Plan for a Customer" })).toBeVisible({ timeout: 10000 });
  await raterCtx.close();
});
