import { test, expect } from "@playwright/test";

// Business Settings (renamed from "Company Settings") must be complete
// — address, GST number, PAN number, state, and at least one payment
// method (bank details or UPI) — before staff/admin can generate
// invoices. Real end-to-end coverage: a brand-new org (created for real
// via the platform admin's "+ New Organization" form's underlying API,
// same as company-onboarding-regression.spec.ts) starts with an empty
// Business Settings row, so every staff-initiated invoicing action
// should be blocked with a clear error until it's filled in — then work
// once it's complete.
test.describe("Business Settings mandatory-completion gate", () => {
  test("invoice-creating actions are blocked until Business Settings is complete, then work once it is", async ({ browser }) => {
    test.setTimeout(2 * 60 * 1000);
    const suffix = Date.now();
    const orgName = `Settings Gate Test Co ${suffix}`;
    const orgSlug = `settings-gate-test-co-${suffix}`;
    const adminEmail = `settings-gate-admin-${suffix}@example.com`;

    // ---- Platform admin provisions a fresh, real org ----
    const platformCtx = await browser.newContext({ storageState: "tests/e2e/.auth/platformAdmin.json" });
    const createOrgRes = await platformCtx.request.post("/api/platform/organizations", {
      data: { name: orgName, slug: orgSlug, planTier: "business", adminFullName: "Settings Gate Admin", adminEmail },
    });
    expect(createOrgRes.ok(), await createOrgRes.text()).toBeTruthy();
    const { tempPassword } = await createOrgRes.json();
    await platformCtx.close();

    // ---- New org's admin logs in for real ----
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await adminPage.goto("/login");
    await adminPage.getByPlaceholder("Enter your email").fill(adminEmail);
    await adminPage.getByPlaceholder("Enter your password").fill(tempPassword);
    await adminPage.getByRole("button", { name: "Sign in" }).click();
    await expect(adminPage).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Rename check: nav shows "Business Settings", not "Company Settings".
    const adminGroupRow = adminPage.getByRole("button", { name: "Administration" });
    await expect(adminGroupRow).toBeVisible({ timeout: 10000 });
    await adminGroupRow.hover();
    const adminFlyout = adminPage.locator("div.absolute", { hasText: "Administration" }).first();
    await expect(adminFlyout).toBeVisible();
    await expect(adminFlyout.getByText("Business Settings", { exact: true })).toBeVisible();
    await expect(adminPage.getByText("Company Settings")).toHaveCount(0);

    // The org-level completion banner should be showing (fresh org, no
    // settings filled in yet) somewhere on the dashboard.
    await adminPage.goto("/dashboard");
    await expect(adminPage.getByText("Business Settings is incomplete", { exact: false })).toBeVisible({ timeout: 10000 });

    // ---- A real customer to buy a plan for ----
    const customerEmail = `settings-gate-customer-${suffix}@example.com`;
    const createCustomerRes = await adminPage.request.post("/api/admin/create-user", {
      data: { fullName: "Settings Gate Customer", email: customerEmail, accountType: "customer", customerTier: "free" },
    });
    expect(createCustomerRes.ok(), await createCustomerRes.text()).toBeTruthy();
    const { userId: customerId } = await createCustomerRes.json();

    // ---- Blocked: buy-for-customer ----
    const buyRes = await adminPage.request.post("/api/orders/buy-for-customer", {
      data: { customerId, service: "GST Registration", plan: "Basic", price: 1999 },
    });
    expect(buyRes.status()).toBe(400);
    const buyError = (await buyRes.json()).error as string;
    expect(buyError).toContain("Business Settings is incomplete");
    expect(buyError).toContain("Address");
    expect(buyError).toContain("GST Number");

    // ---- Blocked: converting a lead ----
    const leadRes = await adminPage.request.post("/api/leads", {
      data: { name: "Settings Gate Lead", email: `settings-gate-lead-${suffix}@example.com`, phone: "9876543210", service: "GST Registration", plan: "Basic", planPrice: "₹1,999" },
    });
    expect(leadRes.ok()).toBeTruthy();
    const { lead } = await leadRes.json();
    const convertRes = await adminPage.request.post(`/api/leads/${lead.id}/convert`);
    expect(convertRes.status()).toBe(400);
    expect((await convertRes.json()).error).toContain("Business Settings is incomplete");

    // ---- Blocked: Invoice CRM's ad-hoc invoice wizard (staff/admin POST /api/invoices) ----
    const adHocInvoiceRes = await adminPage.request.post("/api/invoices", {
      data: { customerId, items: [{ description: "Ad-hoc test item", unit: "Nos", quantity: 1, rate: 500, discount: 0 }] },
    });
    expect(adHocInvoiceRes.status()).toBe(400);
    expect((await adHocInvoiceRes.json()).error).toContain("Business Settings is incomplete");

    // ---- Complete Business Settings for real, via the actual UI ----
    await adminPage.goto("/dashboard/admin/business-settings");
    await expect(adminPage.getByRole("heading", { name: "Business Settings" })).toBeVisible({ timeout: 10000 });
    await expect(adminPage.getByText("Still missing:", { exact: false })).toBeVisible();

    await adminPage.locator("text=Address *").locator("xpath=following-sibling::textarea[1]").fill(`${orgName} HQ, MG Road`);
    await adminPage.locator("text=GST Number *").locator("xpath=following-sibling::input[1]").fill("07AAAAA0000A1Z5");
    await adminPage.locator("text=PAN Number *").locator("xpath=following-sibling::input[1]").fill("AAAAA0000A");
    await adminPage.locator("text=State *").locator("xpath=following-sibling::select[1]").selectOption({ label: "Delhi" });
    await adminPage.getByRole("button", { name: "Save Settings" }).click();
    await expect(adminPage.getByText("Settings saved.")).toBeVisible({ timeout: 10000 });
    // handleSave's own post-save reload (load()) is still in flight here —
    // it resets every field on the page (including the sibling Invoicing
    // form's), so filling Bank Name/Account/IFSC before it settles gets
    // silently wiped back to empty. Wait for that fetch to land first.
    await adminPage.waitForLoadState("networkidle");

    // State alone isn't enough — a payment method is also required, and
    // it's saved via the separate Invoicing form.
    await adminPage.locator("text=Bank Name").locator("xpath=following-sibling::input[1]").fill("HDFC Bank");
    await adminPage.locator("text=Account Number").locator("xpath=following-sibling::input[1]").fill("50100999888777");
    await adminPage.locator("text=IFSC Code").locator("xpath=following-sibling::input[1]").fill("HDFC0001234");
    await adminPage.getByRole("button", { name: "Save Invoicing Settings" }).click();
    await expect(adminPage.getByText("Invoicing settings saved.")).toBeVisible({ timeout: 10000 });

    await expect(adminPage.getByText("Business Settings is complete", { exact: false })).toBeVisible({ timeout: 10000 });
    await expect(adminPage.getByText("Still missing:", { exact: false })).toHaveCount(0);

    // ---- The banner should be gone on other pages now too ----
    await adminPage.goto("/dashboard");
    await expect(adminPage.getByText("Business Settings is incomplete", { exact: false })).toHaveCount(0, { timeout: 10000 });

    // ---- Now unblocked: buy-for-customer succeeds for real ----
    const buyRes2 = await adminPage.request.post("/api/orders/buy-for-customer", {
      data: { customerId, service: "GST Registration", plan: "Basic", price: 1999 },
    });
    expect(buyRes2.ok(), await buyRes2.text()).toBeTruthy();
    const { invoice } = await buyRes2.json();
    expect(invoice?.id).toBeTruthy();

    // ---- And converting a lead succeeds too ----
    const convertRes2 = await adminPage.request.post(`/api/leads/${lead.id}/convert`);
    expect(convertRes2.ok(), await convertRes2.text()).toBeTruthy();

    await adminCtx.close();
  });
});
