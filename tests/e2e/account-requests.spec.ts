import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// Real approve/reject click-through of the pending Account Requests
// queue — approving actually creates a working account (via the same
// helper Create User uses), rejecting requires a reason and marks the
// request rejected rather than leaving it in limbo.
test("admin approves one pending request and rejects another with a reason", async ({ page, request }) => {
  const suffix = Date.now();
  const approveEmail = `account-req-approve-${suffix}@example.com`;
  const rejectEmail = `account-req-reject-${suffix}@example.com`;

  const raterCtx = await page.context().browser()!.newContext({ storageState: "tests/e2e/.auth/rater.json" });
  const approveReq = await raterCtx.request.post("/api/account-requests/request-user", {
    data: { fullName: `Approve Me ${suffix}`, email: approveEmail, accountType: "customer" },
  });
  expect(approveReq.ok(), await approveReq.text()).toBeTruthy();
  const rejectReq = await raterCtx.request.post("/api/account-requests/request-user", {
    data: { fullName: `Reject Me ${suffix}`, email: rejectEmail, accountType: "customer" },
  });
  expect(rejectReq.ok(), await rejectReq.text()).toBeTruthy();
  await raterCtx.close();

  await page.goto("/dashboard/admin/account-requests");
  await expect(page.getByRole("heading", { name: "Account Requests", exact: true })).toBeVisible({ timeout: 15000 });

  const approveRow = page.locator("tr", { hasText: `Approve Me ${suffix}` });
  await expect(approveRow).toBeVisible({ timeout: 10000 });
  await approveRow.getByRole("button", { name: "Approve" }).click();
  await expect(approveRow).toHaveCount(0, { timeout: 15000 });

  const rejectRow = page.locator("tr", { hasText: `Reject Me ${suffix}` });
  await expect(rejectRow).toBeVisible({ timeout: 10000 });
  await rejectRow.getByRole("button", { name: "Reject", exact: true }).click();
  await rejectRow.getByPlaceholder("Reason for rejection").fill("Not a real business need — Playwright test.");
  await rejectRow.getByRole("button", { name: "Confirm" }).click();
  await expect(rejectRow).toHaveCount(0, { timeout: 15000 });

  // Verify server-side via the public status-check endpoint.
  const approvedStatus = await request.get(`/api/account-requests?email=${encodeURIComponent(approveEmail)}`);
  expect((await approvedStatus.json()).request.status).toBe("approved");
  const rejectedStatus = await request.get(`/api/account-requests?email=${encodeURIComponent(rejectEmail)}`);
  const rejectedData = (await rejectedStatus.json()).request;
  expect(rejectedData.status).toBe("rejected");
  expect(rejectedData.review_note).toContain("Not a real business need");
});

test("API: a non-admin staff member cannot approve a request even if they can see the queue", async ({ browser }) => {
  const suffix = Date.now();
  const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
  const createRes = await raterCtx.request.post("/api/account-requests/request-user", {
    data: { fullName: `Rater Cannot Approve ${suffix}`, email: `rater-cannot-approve-${suffix}@example.com`, accountType: "customer" },
  });
  const { request: created } = await createRes.json();

  const approveRes = await raterCtx.request.patch(`/api/account-requests/${created.id}`, { data: { decision: "approve" } });
  expect(approveRes.status()).toBe(403);
  await raterCtx.close();
});
