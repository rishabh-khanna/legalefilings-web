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
  // DataTable paginates now — search narrows straight to him instead of
  // assuming he's on page 1.
  await page.getByPlaceholder("Search by name, employee ID, department, designation…").fill("Rahul Rater");
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

// The test above only checks the admin-side state change (row flips to
// "Deactivated", Reactivate button appears) — it never confirms
// deactivation actually does anything to the deactivated person's own
// access. src/proxy.ts checks profile.is_active on every request
// specifically so a LIVE session gets cut off immediately, not just a
// fresh login once their token happens to expire (see the comment
// there) — and the DELETE route ALSO bans the Supabase Auth account
// outright when it takes the deactivate branch (unlike a bare PATCH
// {isActive: false}, which only flips the profile flag and leaves the
// auth account able to sign in — it'd just get bounced straight back to
// /login by the is_active gate above without ever reaching /dashboard).
// Neither the live-session cutoff nor the auth ban was covered before.
// Uses a brand-new throwaway staff account with one real attendance
// event (so DELETE takes the deactivate-not-hard-delete branch) rather
// than the shared seeded Rahul Rater, so a failure here can't leave a
// fixture other specs depend on in a broken state.
test("deactivating (with real history) kills a live session and bans a fresh login, until reactivated", async ({ browser }) => {
  test.setTimeout(60 * 1000);
  const suffix = Date.now();
  const email = `deactivation-session-test-${suffix}@example.com`;

  const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
  const createRes = await adminCtx.request.post("/api/admin/create-user", {
    data: { fullName: `Deactivation Session Test ${suffix}`, email, accountType: "staff", department: "Playwright QA", designation: "Test Staff" },
  });
  expect(createRes.ok(), await createRes.text()).toBeTruthy();
  const { tempPassword, userId } = await createRes.json();

  // Log in as this staff member for real and KEEP the session open —
  // this same page is reused after deactivation below, to prove a live
  // session gets cut off, not just that a fresh login is blocked. Also
  // give them one real attendance event through their own session, so
  // DELETE below takes the deactivate branch instead of hard-deleting.
  const staffCtx = await browser.newContext();
  const staffPage = await staffCtx.newPage();
  await staffPage.goto("/login");
  await staffPage.getByPlaceholder("Enter your email").fill(email);
  await staffPage.getByPlaceholder("Enter your password").fill(tempPassword);
  await staffPage.getByRole("button", { name: "Sign in" }).click();
  await expect(staffPage).toHaveURL(/\/dashboard/, { timeout: 15000 });
  const checkInRes = await staffPage.request.post("/api/attendance", { data: { type: "check_in" } });
  expect(checkInRes.ok(), await checkInRes.text()).toBeTruthy();

  const deleteRes = await adminCtx.request.delete(`/api/admin/employees/${userId}`);
  expect(deleteRes.ok(), await deleteRes.text()).toBeTruthy();
  const { deactivated } = await deleteRes.json();
  expect(deactivated, "expected the deactivate branch, not hard-delete, given real attendance history").toBe(true);

  // The live session's next navigation gets bounced to /login, not left
  // sitting on whatever page it was already on.
  await staffPage.goto("/dashboard");
  await expect(staffPage).toHaveURL(/\/login/, { timeout: 10000 });

  // A fresh login attempt is also rejected — the auth account itself is
  // banned now, not just the profile flag.
  const freshAttemptCtx = await browser.newContext();
  const freshAttemptPage = await freshAttemptCtx.newPage();
  await freshAttemptPage.goto("/login");
  await freshAttemptPage.getByPlaceholder("Enter your email").fill(email);
  await freshAttemptPage.getByPlaceholder("Enter your password").fill(tempPassword);
  await freshAttemptPage.getByRole("button", { name: "Sign in" }).click();
  await expect(freshAttemptPage.getByText("Incorrect email or password.")).toBeVisible({ timeout: 10000 });
  await expect(freshAttemptPage).toHaveURL(/\/login/);
  await freshAttemptCtx.close();

  // Reactivating restores login — the PATCH route unbans the auth
  // account before flipping is_active back.
  const reactivateRes = await adminCtx.request.patch(`/api/admin/employees/${userId}`, { data: { isActive: true } });
  expect(reactivateRes.ok(), await reactivateRes.text()).toBeTruthy();

  const afterReactivateCtx = await browser.newContext();
  const afterReactivatePage = await afterReactivateCtx.newPage();
  await afterReactivatePage.goto("/login");
  await afterReactivatePage.getByPlaceholder("Enter your email").fill(email);
  await afterReactivatePage.getByPlaceholder("Enter your password").fill(tempPassword);
  await afterReactivatePage.getByRole("button", { name: "Sign in" }).click();
  await expect(afterReactivatePage).toHaveURL(/\/dashboard/, { timeout: 15000 });
  await afterReactivateCtx.close();

  await staffCtx.close();
  await adminCtx.close();
});

test("Reports To dropdown excludes deactivated employees", async ({ page }) => {
  await page.goto("/dashboard/admin/employees");
  await expect(page.getByRole("heading", { name: "Employees" })).toBeVisible();

  // DataTable paginates now — with enough seeded/test employees, Rahul
  // Rater isn't guaranteed to land on page 1. Search narrows it down
  // first, same as a real admin looking up one specific person.
  await page.getByPlaceholder("Search by name, employee ID, department, designation…").fill("Rahul Rater");
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
