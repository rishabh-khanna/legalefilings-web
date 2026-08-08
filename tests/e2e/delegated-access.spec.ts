import { test, expect } from "@playwright/test";

// Delegated Access (staff_tool_grants) — an admin hands one normally
// admin-only section to a specific staff member without promoting them.
// Real end-to-end: grant "Employees" to the seeded rater, confirm they
// can now actually reach /dashboard/admin/employees (both the page load
// and the nav item appearing), then revoke it and confirm access is
// removed again — both directions matter equally here.
test.describe("Delegated Access", () => {
  test("granting and revoking a tool grant actually changes staff access, not just the grants table", async ({ browser }) => {
    test.setTimeout(60 * 1000);
    const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
    const adminPage = await adminCtx.newPage();

    await adminPage.goto("/dashboard/admin/tool-access");
    await expect(adminPage.getByRole("heading", { name: "Delegated Access" })).toBeVisible({ timeout: 15000 });

    // Grant Rahul Rater access to Employees via the real form.
    await adminPage.locator("select").nth(0).selectOption({ label: "Rahul Rater" });
    await adminPage.locator("select").nth(1).selectOption({ label: "Employees" });
    await adminPage.getByRole("button", { name: "Grant", exact: true }).click();
    await expect(adminPage.getByText("Access granted.")).toBeVisible({ timeout: 10000 });

    const grantRow = adminPage.locator("tr", { hasText: "Rahul Rater" }).filter({ hasText: "Employees" });
    await expect(grantRow).toBeVisible({ timeout: 10000 });
    await expect(grantRow.getByText("Active", { exact: true })).toBeVisible();

    // As Rahul: the page should actually load now (proxy.ts's
    // ADMIN_ONLY_SECTIONS guard checks for a live grant before bouncing
    // a non-admin), and the nav should surface it too, not just the URL.
    const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
    const raterPage = await raterCtx.newPage();
    await raterPage.goto("/dashboard/admin/employees");
    await expect(raterPage).toHaveURL(/\/dashboard\/admin\/employees/, { timeout: 10000 });
    await expect(raterPage.getByRole("heading", { name: "Employees" })).toBeVisible({ timeout: 10000 });

    const adminGroupRow = raterPage.getByRole("button", { name: "Administration" });
    await expect(adminGroupRow).toBeVisible({ timeout: 10000 });
    await adminGroupRow.hover();
    const flyout = raterPage.locator("div.absolute", { hasText: "Administration" }).first();
    await expect(flyout.getByText("Employees", { exact: true })).toBeVisible();
    await raterCtx.close();

    // Revoke it back on the admin side. Playwright auto-DISMISSES native
    // dialogs by default (not accepts) — an explicit handler is required
    // or the window.confirm() in handleRevoke short-circuits and nothing
    // ever gets revoked.
    adminPage.once("dialog", (dialog) => dialog.accept());
    await grantRow.getByRole("button", { name: "Revoke access" }).click();
    await expect(adminPage.getByText("Access revoked.")).toBeVisible({ timeout: 10000 });
    await expect(adminPage.locator("tr", { hasText: "Rahul Rater" }).filter({ hasText: "Employees" })).toHaveCount(0, { timeout: 10000 });

    // As Rahul again, fresh navigation: access should be gone — bounced
    // back to /dashboard by proxy.ts, same as before the grant existed.
    const raterCtx2 = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
    const raterPage2 = await raterCtx2.newPage();
    await raterPage2.goto("/dashboard/admin/employees");
    await expect(raterPage2).toHaveURL(/\/dashboard$/, { timeout: 10000 });
    await raterCtx2.close();

    await adminCtx.close();
  });

  test("a grant with an expiry date in the past is treated as expired, not active", async ({ browser }) => {
    const adminCtx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
    const api = adminCtx.request;

    // Look up the rater's real profile id via the staff list the page
    // itself uses, so this doesn't depend on a hardcoded id.
    const grantsRes = await api.get("/api/admin/tool-grants");
    expect(grantsRes.ok()).toBeTruthy();
    const { staff } = await grantsRes.json();
    const rahul = staff.find((s: { full_name: string | null }) => s.full_name === "Rahul Rater");
    expect(rahul, "seeded staff member 'Rahul Rater' not found").toBeTruthy();

    const pastDate = "2020-01-01";
    const createRes = await api.post("/api/admin/tool-grants", {
      data: { staffId: rahul.id, toolKey: "employees", expiresAt: pastDate },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();

    // The API-level access check (hasToolAccess) should treat this as
    // not-granted, even though a row exists.
    const raterCtx = await adminCtx.browser()!.newContext({ storageState: "tests/e2e/.auth/rater.json" });
    const employeesApiRes = await raterCtx.request.get("/api/admin/employees");
    expect(employeesApiRes.status()).toBe(403);
    await raterCtx.close();

    await adminCtx.close();
  });
});
