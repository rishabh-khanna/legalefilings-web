import { test, expect } from "@playwright/test";

// crm-access.spec.ts already covers the request/approve round trip
// itself (real UI, both sides) and only checks ONE resulting page
// (Employees) as proof the promotion worked. This spec starts from an
// already-approved promotion (set up via the same real APIs, just
// skipping the UI clicks that spec already exercises) and instead
// sweeps every tool the CRM-access page promises: "Leads CRM, Invoice
// CRM, Team Management, Attendance & Leave, Payroll" (see
// src/content/dashboard-manual.ts's /dashboard/crm-access entry), plus a
// representative set of the other admin-only sections a fresh org admin
// should have unrestricted access to with zero extra grants —
// hasToolAccess/proxy.ts both treat account_type === "admin" as an
// automatic pass, no Delegated Access grant needed (see
// delegated-access.spec.ts for the staff/non-admin equivalent, which
// DOES require one).
test("a customer, once approved for their own CRM workspace, has full org-admin access — not just one tool", async ({ browser }) => {
  test.setTimeout(90 * 1000);
  const suffix = Date.now();
  const customerEmail = `full-access-customer-${suffix}@example.com`;
  const orgName = `Full Access Test Co ${suffix}`;

  // ---- Set up: a real customer, a real paid purchase (the CRM-access
  // eligibility requirement), a real request, a real approval. ----
  const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
  const createRes = await adminCtx.request.post("/api/admin/create-user", {
    data: { fullName: `Full Access Customer ${suffix}`, email: customerEmail, accountType: "customer", customerTier: "paid" },
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

  const customerCtx = await browser.newContext();
  const customerPage = await customerCtx.newPage();
  await customerPage.goto("/login");
  await customerPage.getByPlaceholder("Enter your email").fill(customerEmail);
  await customerPage.getByPlaceholder("Enter your password").fill(tempPassword);
  await customerPage.getByRole("button", { name: "Sign in" }).click();
  await expect(customerPage).toHaveURL(/\/dashboard/, { timeout: 15000 });

  const requestRes = await customerPage.request.post("/api/crm-access-requests", { data: { organizationName: orgName } });
  expect(requestRes.ok(), await requestRes.text()).toBeTruthy();
  const { request: crmRequest } = await requestRes.json();
  await customerCtx.close();

  const platformCtx = await browser.newContext({ storageState: "tests/e2e/.auth/platformAdmin.json" });
  const approveRes = await platformCtx.request.patch(`/api/platform/crm-access-requests/${crmRequest.id}`, { data: { decision: "approve" } });
  expect(approveRes.ok(), await approveRes.text()).toBeTruthy();
  await platformCtx.close();

  // ---- The same login, now promoted, actually reaches every promised
  // tool plus the wider admin surface — not just Employees. ----
  const promotedCtx = await browser.newContext();
  const promotedPage = await promotedCtx.newPage();
  await promotedPage.goto("/login");
  await promotedPage.getByPlaceholder("Enter your email").fill(customerEmail);
  await promotedPage.getByPlaceholder("Enter your password").fill(tempPassword);
  await promotedPage.getByRole("button", { name: "Sign in" }).click();
  await expect(promotedPage).toHaveURL(/\/dashboard/, { timeout: 15000 });

  const tools: [path: string, heading: string][] = [
    // The five tools promised on the CRM-access page itself.
    ["/dashboard/admin/leads", "Pipeline"],
    ["/dashboard/invoice-crm", "Invoice CRM"],
    ["/dashboard/admin/employees", "Employees"],
    ["/dashboard/admin/attendance", "Team Attendance"],
    ["/dashboard/admin/payroll", "Payroll"],
    // Representative admin-only sections beyond those five, to confirm
    // this is real unrestricted org-admin access, not a hardcoded list
    // of exactly five unlocked pages.
    ["/dashboard/admin/leave-requests", "Leave Requests"],
    ["/dashboard/admin/payslips", "Payslips"],
    ["/dashboard/admin/business-settings", "Business Settings"],
    ["/dashboard/holidays", "Holiday Calendar"],
    ["/dashboard/admin/hr-letters", "HR Letter Generator"],
    ["/dashboard/admin/product-catalog", "Invoice Item Catalog"],
    ["/dashboard/admin/departments", "Departments"],
    ["/dashboard/admin/analytics", "Analytics"],
    ["/dashboard/admin/email-failures", "Email Failures"],
    ["/dashboard/documents", "Documents"],
  ];

  for (const [path, heading] of tools) {
    await promotedPage.goto(path);
    await expect(promotedPage, `expected ${path} to actually load, not bounce away`).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));
    await expect(promotedPage.getByRole("heading", { name: heading, exact: true }), `expected the "${heading}" heading on ${path}`).toBeVisible({ timeout: 10000 });
  }

  await promotedCtx.close();
});
