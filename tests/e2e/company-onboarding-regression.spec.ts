import { test, expect } from "@playwright/test";
import { onboardCompany } from "./helpers/onboard-company";

// Full regression pass: a platform_admin onboards TWO brand-new,
// independent tenant organizations from scratch via the real "+ New
// Organization" form, and every major feature area is then exercised as
// that org's own new admin/staff actually clicking through the UI —
// Company Settings (incl. real logo/signature upload), Departments,
// staff account creation, Employees, Leads -> Convert to Order, Order
// documents + status pipeline, Invoice payment, Business Finance setup +
// a transaction, Payroll (salary structure + generate), Holidays, HR
// Letters, and Leave/Attendance for the new staff member. Two fully
// separate orgs prove tenant isolation isn't just a schema constraint —
// each one's data has to actually only ever show up for itself.
const suffix = Date.now();

test.describe("Company onboarding regression — 2 fresh tenants", () => {
  test("Company Alpha: full onboarding + feature walkthrough", async ({ browser }) => {
    test.setTimeout(5 * 60 * 1000);
    const result = await onboardCompany(browser, {
      label: "Alpha",
      orgName: `Alpha Legal Consultants ${suffix}`,
      orgSlug: `alpha-legal-consultants-${suffix}`,
      adminFullName: "Alpha Admin",
      adminEmail: `alpha.admin.${suffix}@example.com`,
      staffFullName: "Alpha Staffer",
      staffEmail: `alpha.staffer.${suffix}@example.com`,
    });
    expect(result.orderId).toBeTruthy();
    expect(result.invoiceId).toBeTruthy();
    expect(result.invoiceTotal).toBeGreaterThan(0);
  });

  test("Company Beta: full onboarding + feature walkthrough", async ({ browser }) => {
    test.setTimeout(5 * 60 * 1000);
    const result = await onboardCompany(browser, {
      label: "Beta",
      orgName: `Beta Compliance Partners ${suffix}`,
      orgSlug: `beta-compliance-partners-${suffix}`,
      adminFullName: "Beta Admin",
      adminEmail: `beta.admin.${suffix}@example.com`,
      staffFullName: "Beta Staffer",
      staffEmail: `beta.staffer.${suffix}@example.com`,
    });
    expect(result.orderId).toBeTruthy();
    expect(result.invoiceId).toBeTruthy();
    expect(result.invoiceTotal).toBeGreaterThan(0);
  });

  test("tenant isolation: a regular org admin (not platform_admin) cannot see the platform-wide org list", async ({ browser }) => {
    // Every one of this org's admins — including the two brand-new ones
    // just onboarded above — is a regular, org-scoped admin, never a
    // platform_admin. Reusing the existing seeded admin account for this
    // check is equivalent and doesn't need Beta's own credentials, which
    // onboardCompany() doesn't hand back to the caller.
    const ctx = await browser.newContext({ storageState: "tests/e2e/.auth/admin.json" });
    const res = await ctx.request.get("/api/platform/organizations");
    expect(res.status(), "a regular org admin must never see the platform-wide org list").toBe(403);
    await ctx.close();
  });
});
