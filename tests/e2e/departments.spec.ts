import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/admin.json" });

// Real click-through of Departments: create a department, add a
// manager-level role to it, toggle it back to Individual, then delete
// the role and the department — verifying each step actually changed
// what's rendered, not just that the request succeeded.
test("admin creates a department, adds a manager-level role, toggles it, then deletes both", async ({ page }) => {
  const suffix = Date.now().toString().slice(-6);
  const deptName = `Playwright Dept ${suffix}`;
  const roleTitle = `Playwright Role ${suffix}`;

  await page.goto("/dashboard/admin/departments");
  await expect(page.getByRole("heading", { name: "Departments" })).toBeVisible({ timeout: 15000 });

  await page.getByPlaceholder("e.g. Sales, Support, Compliance").fill(deptName);
  await page.getByRole("button", { name: "Add Department" }).click();
  await expect(page.getByText("Department created.")).toBeVisible({ timeout: 10000 });

  // With more than one department in the list, a plain hasText/has
  // .filter() combo matches the whole list's wrapper div too (it
  // contains this dept's name AND some other dept's Delete button,
  // satisfying both filters independently) — anchor on the exact <p>
  // holding just this dept's name, then climb to its own card via the
  // nearest rounded-xl ancestor, same pattern used elsewhere in this suite.
  const deptCard = page.locator("p", { hasText: deptName }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await expect(deptCard).toBeVisible();

  await deptCard.getByPlaceholder("e.g. Lead, Manager, Senior Manager").fill(roleTitle);
  await deptCard.locator('input[type="checkbox"]').check();
  await deptCard.getByRole("button", { name: "Add Role" }).click();
  await expect(page.getByText("Role added.")).toBeVisible({ timeout: 10000 });

  // Same wrapper-div trap as deptCard above — anchor on the <span>
  // holding just this role's title, then climb to its own row.
  const roleRow = deptCard.locator("span", { hasText: roleTitle }).locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await expect(roleRow.getByRole("button", { name: "Manager-level" })).toBeVisible();

  await roleRow.getByRole("button", { name: "Manager-level" }).click();
  await expect(roleRow.getByRole("button", { name: "Individual" })).toBeVisible({ timeout: 10000 });

  page.once("dialog", (dialog) => dialog.accept());
  await roleRow.getByRole("button", { name: "Delete role" }).click();
  await expect(page.getByText("Role deleted.")).toBeVisible({ timeout: 10000 });
  await expect(page.locator("div", { hasText: roleTitle })).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept());
  await deptCard.getByRole("button", { name: "Delete Department" }).click();
  await expect(page.getByText("Department deleted.")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(deptName)).toHaveCount(0);
});

test("API: staff without the departments tool grant is forbidden from creating one", async ({ browser }) => {
  const raterCtx = await browser.newContext({ storageState: "tests/e2e/.auth/rater.json" });
  const res = await raterCtx.request.post("/api/admin/departments", {
    data: { name: "Should Be Blocked" },
  });
  expect(res.status()).toBe(403);
  await raterCtx.close();
});
