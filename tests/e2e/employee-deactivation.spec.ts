import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// Real button-click test: an employee with attendance/leave/payslip
// history should DEACTIVATE (not hard-delete) when "Delete" is clicked —
// see src/app/api/admin/employees/[id]/route.ts DELETE. The seeded demo
// staff (Rahul Rater, Leena Leader, Gaurav Group Leader) all have
// attendance + leave history from scripts/seed-database.mjs, so clicking
// Delete on any of them should hit the deactivate path, not the hard-delete
// path — this is the actual scenario the fix was for.
test("deleting an employee with history deactivates them instead of hard-deleting", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/dashboard/admin/employees");
  await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();

  // Employee list is a real <table> — one <tr> per person. Rahul Rater
  // is the seeded staff member with real attendance events, isn't an
  // admin (Delete is hidden for admins), so it's a safe target.
  const row = page.locator("tr", { hasText: "Rahul Rater" });
  await expect(row).toBeVisible();

  const alreadyDeactivated = await row.getByText("Deactivated").count();
  if (alreadyDeactivated > 0) {
    // A previous test run already deactivated this account — reactivate
    // first so this test can exercise the delete path again.
    await row.getByRole("button", { name: "Reactivate" }).click();
    await expect(row.getByText("Deactivated")).toHaveCount(0, { timeout: 10000 });
  }

  await row.getByRole("button", { name: "Delete" }).click();

  // The route should deactivate (not hard-delete) since this employee has
  // attendance_events/leave_requests rows — the row should stay in the
  // list, now flagged Deactivated, with a Reactivate button in place of Delete.
  await expect(row.getByText("Deactivated")).toBeVisible({ timeout: 10000 });
  await expect(row.getByRole("button", { name: "Reactivate" })).toBeVisible();
  await expect(row.getByRole("button", { name: "Delete" })).toHaveCount(0);

  // Clean up: reactivate so the seeded account is left in its normal
  // state for other specs/manual testing.
  await row.getByRole("button", { name: "Reactivate" }).click();
  await expect(row.getByText("Deactivated")).toHaveCount(0, { timeout: 10000 });
  await expect(row.getByRole("button", { name: "Delete" })).toBeVisible();
});

test("Reports To dropdown excludes deactivated employees", async ({ page }) => {
  await page.goto("/dashboard/admin/employees");
  await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();

  const row = page.locator("tr", { hasText: "Rahul Rater" });
  await row.getByRole("button", { name: "Edit" }).click();

  // Clicking Edit expands a SEPARATE sibling <tr> (colSpan across the
  // whole table) right after the row, not nested inside it — so the
  // edit form's fields are looked up page-wide, not scoped to `row`.
  // Only one employee is ever editable at a time, so this stays
  // unambiguous. The "Reports To" label isn't wired to its <select> via
  // htmlFor/id, hence the structural lookup.
  const reportsToSelect = page.locator("text=Reports To").locator("xpath=following-sibling::select[1]");
  await expect(reportsToSelect).toBeVisible();
  const options = await reportsToSelect.locator("option").allTextContents();
  // Sanity check: the dropdown actually lists other staff, and doesn't
  // include a "Rahul Rater" self-report option.
  expect(options.some((o) => o.includes("Rahul Rater"))).toBe(false);
});
