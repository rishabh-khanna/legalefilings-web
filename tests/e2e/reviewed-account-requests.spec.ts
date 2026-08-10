import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// Reviewed Account Requests is the read-only history split off from the
// pending queue — real end-to-end: submit + approve a request via the
// API (the approval click-through itself is covered by
// account-requests.spec.ts), then confirm it shows up here with the
// right status, and that a still-pending one does NOT.
test("an approved request appears in Reviewed history; a pending one doesn't", async ({ page, browser, request }) => {
  const suffix = Date.now();
  const approvedName = `Reviewed History Approved ${suffix}`;
  const pendingName = `Reviewed History Pending ${suffix}`;

  const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
  const approvedReq = await raterCtx.request.post("/api/account-requests/request-user", {
    data: { fullName: approvedName, email: `reviewed-history-approved-${suffix}@example.com`, accountType: "customer" },
  });
  const { request: approvedRow } = await approvedReq.json();
  const pendingReq = await raterCtx.request.post("/api/account-requests/request-user", {
    data: { fullName: pendingName, email: `reviewed-history-pending-${suffix}@example.com`, accountType: "customer" },
  });
  await pendingReq.json();
  await raterCtx.close();

  const approveRes = await request.patch(`/api/account-requests/${approvedRow.id}`, { data: { decision: "approve" } });
  expect(approveRes.ok(), await approveRes.text()).toBeTruthy();

  await page.goto("/dashboard/admin/reviewed-account-requests");
  await expect(page.getByRole("heading", { name: "Reviewed Account Requests" })).toBeVisible({ timeout: 15000 });

  const approvedRowLocator = page.locator("tr", { hasText: approvedName });
  await expect(approvedRowLocator).toBeVisible({ timeout: 10000 });
  await expect(approvedRowLocator.getByText("approved", { exact: true })).toBeVisible();

  // Still pending — must not show up in the reviewed history.
  await expect(page.locator("tr", { hasText: pendingName })).toHaveCount(0);

  // Search should also find it.
  await page.getByPlaceholder("Search by name, email, phone, status…").fill(approvedName);
  await expect(approvedRowLocator).toBeVisible();
});
