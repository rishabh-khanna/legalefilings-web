import { test, expect } from "@playwright/test";

// Full real flow: a customer with a paid purchase requests their own
// CRM workspace, a platform_admin approves it, and the SAME login
// becomes that new org's admin (see
// /api/platform/crm-access-requests/[id]'s own comment — approving
// promotes the existing customer login rather than issuing a second
// account). Built on a brand-new customer + invoice created fresh for
// this test, not a shared seeded account, so the "no existing request
// yet" branch is guaranteed.
test("customer requests CRM access, platform admin approves it, customer becomes their new org's admin", async ({ browser }) => {
  test.setTimeout(90 * 1000);
  const suffix = Date.now();
  const customerEmail = `crm-access-customer-${suffix}@example.com`;
  const orgName = `Crm Access Test Co ${suffix}`;

  const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
  const createRes = await adminCtx.request.post("/api/admin/create-user", {
    data: { fullName: `Crm Access Customer ${suffix}`, email: customerEmail, accountType: "customer", customerTier: "paid" },
  });
  expect(createRes.ok(), await createRes.text()).toBeTruthy();
  const { tempPassword, userId } = await createRes.json();

  const buyRes = await adminCtx.request.post("/api/orders/buy-for-customer", {
    data: { customerId: userId, service: "GST Registration", plan: "Basic", price: 1999 },
  });
  expect(buyRes.ok(), await buyRes.text()).toBeTruthy();
  const { invoice } = await buyRes.json();
  const payRes = await adminCtx.request.post(`/api/invoices/${invoice.id}/record-payment`, {
    data: { amount: Number(invoice.total), paymentMode: "Bank Transfer" },
  });
  expect(payRes.ok(), await payRes.text()).toBeTruthy();
  await adminCtx.close();

  // ---- Customer logs in for real and requests CRM access via the UI ----
  const customerCtx = await browser.newContext();
  const customerPage = await customerCtx.newPage();
  await customerPage.goto("/login");
  await customerPage.getByPlaceholder("Enter your email").fill(customerEmail);
  await customerPage.getByPlaceholder("Enter your password").fill(tempPassword);
  await customerPage.getByRole("button", { name: "Sign in" }).click();
  await expect(customerPage).toHaveURL(/\/dashboard/, { timeout: 15000 });

  await customerPage.goto("/dashboard/crm-access");
  await expect(customerPage.getByRole("heading", { name: "Request CRM Access" })).toBeVisible({ timeout: 15000 });
  await customerPage.getByPlaceholder("Your company name").fill(orgName);
  await customerPage.getByRole("button", { name: "Set Up My CRM" }).click();
  await expect(customerPage.getByText(`Your request for ${orgName} is under review`, { exact: false })).toBeVisible({ timeout: 10000 });
  await customerCtx.close();

  // ---- Platform admin approves it via the real UI ----
  const platformCtx = await browser.newContext({ storageState: "tests/e2e/.auth/platformAdmin.json" });
  const platformPage = await platformCtx.newPage();
  await platformPage.goto("/dashboard/platform/crm-requests");
  await expect(platformPage.getByRole("heading", { name: "CRM Requests", exact: true })).toBeVisible({ timeout: 15000 });

  // Pending/Reviewed is now a single tabbed table (Pending is the default
  // tab), not two always-visible sections — only one table exists in the
  // DOM at a time, so no section-scoping is needed, just a tab switch.
  const pendingRow = platformPage.locator("tr", { hasText: orgName });
  await expect(pendingRow).toBeVisible({ timeout: 10000 });
  await pendingRow.getByRole("button", { name: "Approve" }).click();
  await expect(platformPage.locator("tr", { hasText: orgName })).toHaveCount(0, { timeout: 15000 });

  await platformPage.getByRole("button", { name: "Reviewed", exact: true }).click();
  const reviewedRow = platformPage.locator("tr", { hasText: orgName });
  await expect(reviewedRow).toBeVisible({ timeout: 10000 });
  await expect(reviewedRow.getByText("approved", { exact: true })).toBeVisible();
  await platformCtx.close();

  // ---- The same login is now that new org's admin ----
  const promotedCtx = await browser.newContext();
  const promotedPage = await promotedCtx.newPage();
  await promotedPage.goto("/login");
  await promotedPage.getByPlaceholder("Enter your email").fill(customerEmail);
  await promotedPage.getByPlaceholder("Enter your password").fill(tempPassword);
  await promotedPage.getByRole("button", { name: "Sign in" }).click();
  await expect(promotedPage).toHaveURL(/\/dashboard/, { timeout: 15000 });
  await promotedPage.goto("/dashboard/admin/employees");
  await expect(promotedPage.getByRole("heading", { name: "Employees" })).toBeVisible({ timeout: 15000 });
  await promotedCtx.close();
});

test("API: a customer with no paid purchase cannot request CRM access", async ({ browser }) => {
  const suffix = Date.now();
  const customerEmail = `no-purchase-customer-${suffix}@example.com`;

  const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
  const createRes = await adminCtx.request.post("/api/admin/create-user", {
    data: { fullName: `No Purchase Customer ${suffix}`, email: customerEmail, accountType: "customer", customerTier: "free" },
  });
  expect(createRes.ok(), await createRes.text()).toBeTruthy();
  const { tempPassword } = await createRes.json();
  await adminCtx.close();

  const noPurchaseCtx = await browser.newContext();
  const noPurchasePage = await noPurchaseCtx.newPage();
  await noPurchasePage.goto("/login");
  await noPurchasePage.getByPlaceholder("Enter your email").fill(customerEmail);
  await noPurchasePage.getByPlaceholder("Enter your password").fill(tempPassword);
  await noPurchasePage.getByRole("button", { name: "Sign in" }).click();
  await expect(noPurchasePage).toHaveURL(/\/dashboard/, { timeout: 15000 });

  const res = await noPurchasePage.request.post("/api/crm-access-requests", { data: { organizationName: "Should Be Blocked" } });
  expect(res.status()).toBe(403);
  await noPurchaseCtx.close();
});
