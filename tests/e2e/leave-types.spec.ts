import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// Leave Types (admin-only, or a staff member individually delegated the
// "leave_types" tool) — each org defines its own applyable leave types
// here, with a yearly credit (accrued monthly) and a carry-forward cap.
// Real UI: create one, edit its days/year inline, then deactivate it.
test("admin creates a leave type, edits its credit inline, then deactivates it", async ({ page, request }) => {
  const suffix = Date.now().toString().slice(-6);
  const name = `Playwright Test Leave ${suffix}`;
  const code = `PT${suffix.slice(-3)}`;

  await page.goto("/dashboard/admin/leave-types");
  await expect(page.getByRole("heading", { name: "Leave Types" })).toBeVisible({ timeout: 15000 });

  await page.getByPlaceholder("e.g. Earned Leave").fill(name);
  await page.getByPlaceholder("e.g. EL").fill(code);
  await page.getByPlaceholder("Days/year").fill("10");
  await page.getByPlaceholder("Carry-forward cap").fill("3");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Leave type created.")).toBeVisible({ timeout: 10000 });

  const row = page.locator("tr", { hasText: name });
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect(row.getByText(`(${code})`)).toBeVisible();

  // Inline edit — the days/year <input> commits on blur, not a separate
  // save button.
  const daysInput = row.locator('input[type="number"]').first();
  await daysInput.fill("15");
  await daysInput.blur();
  await expect(page.getByText("Updated.")).toBeVisible({ timeout: 10000 });

  // Verify server-side, not just the optimistic re-render.
  const listRes = await request.get("/api/leave-types");
  const { leaveTypes } = await listRes.json();
  const created = leaveTypes.find((t: { code: string }) => t.code === code);
  expect(created, "newly created leave type not found via API").toBeTruthy();
  expect(created.annual_credit_days).toBe(15);

  // Deactivate — no hard delete (existing balances/requests would
  // orphan), so it should just drop out of the active list. Playwright
  // auto-DISMISSES native dialogs by default (not accepts) — without an
  // explicit handler, window.confirm() here short-circuits and nothing
  // gets deactivated (the earlier "Updated." from the days-input edit
  // above would still be the only one to ever fire, silently masking
  // this if the wait below weren't scoped to the row actually vanishing).
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Deactivate" }).click();
  await expect(row).toHaveCount(0, { timeout: 10000 });

  const listRes2 = await request.get("/api/leave-types");
  const { leaveTypes: afterDeactivate } = await listRes2.json();
  expect(afterDeactivate.some((t: { code: string }) => t.code === code), "deactivated type should no longer be in the active-only list").toBe(false);
});

test("API: staff without the leave_types tool grant is forbidden from creating one", async ({ browser }) => {
  const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
  const res = await raterCtx.request.post("/api/leave-types", {
    data: { name: "Should Be Blocked", code: "SBB", annualCreditDays: 5, carryForwardCap: 0 },
  });
  expect(res.status()).toBe(403);
  await raterCtx.close();
});
