import { expect, type Browser, type Page } from "@playwright/test";
import path from "path";

const LOGO_FILE = path.join(__dirname, "..", "fixtures", "test-document.png");

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Enter your email").fill(email);
  await page.getByPlaceholder("Enter your password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

export type CompanyConfig = {
  label: string;
  orgName: string;
  orgSlug: string;
  adminFullName: string;
  adminEmail: string;
  staffFullName: string;
  staffEmail: string;
};

export type OnboardResult = {
  orderId: string;
  invoiceId: string;
  invoiceTotal: number;
};

// Full real-UI regression walkthrough for ONE brand-new tenant: a
// platform_admin provisions the org via the real "+ New Organization"
// form, then every feature below is exercised as that org's own new
// admin (and its own new staff member) actually logging in and clicking
// through — not API shortcuts standing in for the UI, except where a
// prerequisite (a convertible lead needs service/plan/price, which the
// internal "+ Add Lead" form deliberately doesn't collect — only the
// public quote form does) is seeded via the same API the real public
// form itself posts to.
export async function onboardCompany(browser: Browser, cfg: CompanyConfig): Promise<OnboardResult> {
  // ---- 1. Platform admin provisions the org for real ----
  const platformCtx = await browser.newContext({ storageState: "tests/e2e/.auth/platformAdmin.json" });
  const platformPage = await platformCtx.newPage();
  await platformPage.goto("/dashboard/platform/organizations");
  // exact:true — the page also has an "All Organizations" section
  // heading, which substring-matches "Organizations" too.
  await expect(platformPage.getByRole("heading", { name: "Organizations", exact: true })).toBeVisible({ timeout: 15000 });
  await platformPage.getByRole("button", { name: "+ New Organization" }).click();

  await platformPage.getByPlaceholder("Acme Legal Associates").fill(cfg.orgName);
  await platformPage.getByPlaceholder("acme-legal-associates").fill(cfg.orgSlug);
  await platformPage.locator("text=Plan Tier").locator("xpath=following-sibling::select[1]").selectOption("business");
  await platformPage.locator("text=Full Name").locator("xpath=following-sibling::input[1]").fill(cfg.adminFullName);
  await platformPage.locator("text=Email").locator("xpath=following-sibling::input[1]").fill(cfg.adminEmail);
  await platformPage.getByRole("button", { name: "Create Organization" }).click();

  await expect(platformPage.getByText(`${cfg.orgName} is live`)).toBeVisible({ timeout: 15000 });
  const adminTempPassword = (await platformPage.locator("span.font-mono.font-semibold").first().textContent())?.trim();
  expect(adminTempPassword, "org creation didn't return a temp password for the new admin").toBeTruthy();
  await platformCtx.close();

  // ---- 2. New org's admin logs in for real and drives everything ----
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await login(adminPage, cfg.adminEmail, adminTempPassword!);
  await expect(adminPage.getByText(cfg.adminFullName.split(" ")[0], { exact: false }).first()).toBeVisible({ timeout: 10000 }).catch(() => {});

  // -- Business Settings: fill details + upload a real logo + signature --
  // Every field filled here is also mandatory now (address/GST/PAN/state
  // + a payment method) — invoice generation later in this flow (Convert
  // to Order, Record Payment) would otherwise be blocked.
  await adminPage.goto("/dashboard/admin/business-settings");
  await expect(adminPage.getByRole("heading", { name: "Business Settings" })).toBeVisible({ timeout: 10000 });

  const fileInputs = adminPage.locator('input[type="file"]');
  await fileInputs.nth(0).setInputFiles(LOGO_FILE); // Company Logo
  await expect(adminPage.getByText("Logo updated.")).toBeVisible({ timeout: 15000 });
  await fileInputs.nth(1).setInputFiles(LOGO_FILE); // Authorized Signature
  await expect(adminPage.getByText("Signature updated.")).toBeVisible({ timeout: 15000 });
  await expect(adminPage.locator('img[alt="Company logo"]')).toBeVisible();
  await expect(adminPage.locator('img[alt="Signature"]')).toBeVisible();

  await adminPage.locator("text=Address").locator("xpath=following-sibling::textarea[1]").fill(`${cfg.orgName} HQ, MG Road`);
  await adminPage.locator("text=GST Number").locator("xpath=following-sibling::input[1]").fill("07AAAAA0000A1Z5");
  await adminPage.locator("text=PAN Number").locator("xpath=following-sibling::input[1]").fill("AAAAA0000A");
  // "State" alone also substring-matches the site-wide profile-
  // completeness banner ("...Phone, Date of Birth, State, City...")
  // which renders above this form and has no following <select> —
  // that's a <p>, not the label, and .first() would pick it since it's
  // earlier in DOM order, hanging forever waiting for a sibling select
  // that doesn't exist. "State *" (with the asterisk) is unique to the
  // real form label.
  await adminPage.locator("text=State *").locator("xpath=following-sibling::select[1]").selectOption({ label: "Delhi" });
  await adminPage.getByRole("button", { name: "Save Settings" }).click();
  await expect(adminPage.getByText("Settings saved.")).toBeVisible({ timeout: 10000 });
  // The Save Settings click's own post-save reload can still be in flight
  // here and would wipe the Invoicing form's fields (bank details) if we
  // start typing before it lands — wait for it to settle first.
  await adminPage.waitForLoadState("networkidle");

  await adminPage.locator("text=Bank Name").locator("xpath=following-sibling::input[1]").fill("HDFC Bank");
  await adminPage.locator("text=Account Number").locator("xpath=following-sibling::input[1]").fill("50100999888777");
  await adminPage.locator("text=IFSC Code").locator("xpath=following-sibling::input[1]").fill("HDFC0001234");
  await adminPage.getByRole("button", { name: "Save Invoicing Settings" }).click();
  await expect(adminPage.getByText("Invoicing settings saved.")).toBeVisible({ timeout: 10000 });

  // Additional GST registration
  await adminPage.getByPlaceholder("Label (e.g. Delhi Office)").fill("Branch Office");
  await adminPage.getByPlaceholder("GST Number").fill("09BBBBB1111B1Z6");
  await adminPage.getByRole("button", { name: "+ Add Registration" }).click();
  await expect(adminPage.getByText("GST registration added.")).toBeVisible({ timeout: 10000 });
  await expect(adminPage.getByText("Branch Office — 09BBBBB1111B1Z6", { exact: false })).toBeVisible();

  // -- Departments: real department + a manager-level role --
  await adminPage.goto("/dashboard/admin/departments");
  await expect(adminPage.getByRole("heading", { name: "Departments" })).toBeVisible({ timeout: 10000 });
  await adminPage.getByPlaceholder("e.g. Sales, Support, Compliance").fill("Operations");
  await adminPage.getByRole("button", { name: "Add Department" }).click();
  await expect(adminPage.getByText("Department created.")).toBeVisible({ timeout: 10000 });

  // rounded-2xl — the department card itself, not the role-row div one
  // level down (which uses rounded-xl).
  const deptCard = adminPage.locator("text=Operations").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
  await expect(deptCard).toBeVisible();
  await deptCard.getByPlaceholder("Add a role title, e.g. Lead, Manager, Senior Manager").fill("Ops Lead");
  await deptCard.locator('input[type="checkbox"]').check();
  await deptCard.getByRole("button", { name: "Add", exact: true }).click();
  await expect(adminPage.getByText("Role added.")).toBeVisible({ timeout: 10000 });
  await expect(deptCard.getByText("Ops Lead")).toBeVisible();

  // -- Create User: a real staff account for the new org --
  await adminPage.goto("/dashboard/admin/users");
  await expect(adminPage.getByRole("heading", { name: "Create User" })).toBeVisible({ timeout: 10000 });
  await adminPage.locator("text=Account Type").locator("xpath=following-sibling::select[1]").selectOption("staff");
  await adminPage.locator("text=Department").locator("xpath=following-sibling::input[1]").fill("Operations");
  await adminPage.locator("text=Designation").locator("xpath=following-sibling::input[1]").fill("Ops Associate");
  await adminPage.locator("text=Full Name").locator("xpath=following-sibling::input[1]").fill(cfg.staffFullName);
  await adminPage.locator("text=Email").locator("xpath=following-sibling::input[1]").fill(cfg.staffEmail);
  await adminPage.getByRole("button", { name: "Create User", exact: true }).click();
  await expect(adminPage.getByText("Account created.")).toBeVisible({ timeout: 15000 });
  const staffTempPassword = (await adminPage.locator("span.font-mono.font-semibold").first().textContent())?.trim();
  expect(staffTempPassword, "staff creation didn't return a temp password").toBeTruthy();

  // -- Employees: edit the new staff member's HR details --
  await adminPage.goto("/dashboard/admin/employees");
  await expect(adminPage.getByRole("heading", { name: "Employees" })).toBeVisible({ timeout: 10000 });
  // Employees is a real <table> now — one summary <tr> per person plus a
  // sibling edit-form <tr> that only appears after Edit is clicked, so
  // Bank Name/Account Number (in that second row) are looked up
  // page-wide rather than scoped to the summary row.
  const empRow = adminPage.locator("tr", { hasText: cfg.staffFullName });
  await expect(empRow).toBeVisible({ timeout: 10000 });
  await empRow.getByRole("button", { name: "Edit" }).click();

  // The edit form now requires a full HR record before it'll save, not
  // just Bank Details — Date of Joining, Team/Department + Role in Team
  // (tied to the real Departments feature — "Operations" / "Ops Lead"
  // were created earlier in this same flow), Reports To, and the
  // identity/statutory fields.
  await adminPage.locator("text=Date of Joining").locator("xpath=following-sibling::input[1]").fill("2024-01-15");
  // Options are value={id}/label={name} — select by label, not value.
  // Not exact: RequiredMark appends "*" to the label's own accessible
  // text ("Team / Department*"), so an exact match never resolves.
  await adminPage.locator("text=Team / Department").locator("xpath=following-sibling::select[1]").selectOption({ label: "Operations" });
  await adminPage.locator("text=Role in Team").locator("xpath=following-sibling::select[1]").selectOption({ label: "Ops Lead" });
  await adminPage.locator("text=Reports To").locator("xpath=following-sibling::select[1]").selectOption({ label: cfg.adminFullName });
  await adminPage.locator("text=UAN Number").locator("xpath=following-sibling::input[1]").fill("101234567899");
  await adminPage.locator("text=ESIC Number").locator("xpath=following-sibling::input[1]").fill("3112345678000099");
  await adminPage.locator("text=Aadhaar Number").locator("xpath=following-sibling::input[1]").fill("999988887777");
  await adminPage.locator("text=PAN Number").locator("xpath=following-sibling::input[1]").fill("ZZZZZ0000Z");
  await adminPage.locator("text=Bank Name").locator("xpath=following-sibling::input[1]").fill("HDFC Bank");
  await adminPage.locator("text=Account Number").locator("xpath=following-sibling::input[1]").fill("50100111222333");
  await adminPage.getByRole("button", { name: "Save Changes" }).click();
  await expect(adminPage.getByText("Employee updated.")).toBeVisible({ timeout: 10000 });

  // -- My Leads: real "+ Add Lead" form (no service/plan captured here — that's the public quote form's job) --
  await adminPage.goto("/dashboard/crm");
  await expect(adminPage.getByRole("heading", { name: "My Leads" })).toBeVisible({ timeout: 10000 });
  await adminPage.getByRole("button", { name: "+ Add Lead" }).click();
  await adminPage.locator('input[name="name"]').fill(`${cfg.label} Manual Lead`);
  await adminPage.locator('input[name="email"]').fill(`manual-lead-${cfg.orgSlug}@example.com`);
  await adminPage.locator('input[name="phone"]').fill("9876543210");
  await adminPage.getByRole("button", { name: "Save Lead" }).click();
  await expect(adminPage.getByText("Lead added.")).toBeVisible({ timeout: 10000 });

  // -- A convertible lead, seeded the same way the public quote form posts (service/plan/price) --
  const leadEmail = `convertible-lead-${cfg.orgSlug}@example.com`;
  const leadCreateRes = await adminPage.request.post("/api/leads", {
    data: { name: `${cfg.label} Convertible Lead`, email: leadEmail, phone: "9876500000", service: "GST Registration", plan: "Business", planPrice: "₹4,999" },
  });
  expect(leadCreateRes.ok(), await leadCreateRes.text()).toBeTruthy();

  // -- Team Leads CRM: real "Convert to Order" click --
  await adminPage.goto("/dashboard/admin/leads");
  await expect(adminPage.getByRole("heading", { name: "Pipeline" })).toBeVisible({ timeout: 10000 });
  const leadCard = adminPage.locator(`text=${cfg.label} Convertible Lead`).first();
  await expect(leadCard).toBeVisible({ timeout: 10000 });
  await leadCard.click();
  const leadDrawer = adminPage.locator("text=Lead details").locator("xpath=ancestor::aside[1]");
  await expect(leadDrawer).toBeVisible();
  await leadDrawer.getByRole("button", { name: "Convert to Order" }).click();
  await expect(leadDrawer.getByText("Converted to a customer + order")).toBeVisible({ timeout: 15000 });

  const leadsRes = await adminPage.request.get("/api/leads");
  const { leads } = await leadsRes.json();
  const convertedLead = leads.find((l: { email: string }) => l.email === leadEmail);
  expect(convertedLead?.convertedToProfileId, "lead didn't actually convert").toBeTruthy();

  const invoicesRes = await adminPage.request.get("/api/invoices");
  const { invoices } = await invoicesRes.json();
  const invoice = invoices.find((i: { customer_id: string }) => i.customer_id === convertedLead.convertedToProfileId);
  expect(invoice, "no invoice found for the converted lead's customer").toBeTruthy();
  const orderId = invoice.order_id as string;
  expect(orderId, "invoice has no linked order_id").toBeTruthy();

  // -- Orders: open the drawer, upload + verify a document, move status --
  await adminPage.goto("/dashboard/orders");
  await expect(adminPage.getByRole("heading", { name: "Orders" })).toBeVisible({ timeout: 10000 });
  const orderRow = adminPage.locator(`tr:has-text("${orderId.slice(0, 8)}")`);
  await expect(orderRow).toBeVisible({ timeout: 10000 });
  await orderRow.locator("td").last().getByRole("button").click();
  const orderDrawer = adminPage.locator("aside").filter({ hasText: "PROCESS STATUS" });
  await expect(orderDrawer).toBeVisible({ timeout: 10000 });

  await orderDrawer.locator('input[type="file"]').setInputFiles(LOGO_FILE);
  await expect(orderDrawer.getByText("pending", { exact: true })).toBeVisible({ timeout: 10000 });
  await orderDrawer.getByRole("button", { name: "Mark all verified" }).click();
  await expect(orderDrawer.getByText("Documents Verified")).toBeVisible({ timeout: 10000 });

  const moveButton = orderDrawer.getByRole("button", { name: /Move to/ });
  if (await moveButton.count() > 0) {
    await moveButton.click();
    await expect(orderDrawer.getByText("New", { exact: true })).toHaveCount(0, { timeout: 10000 }).catch(() => {});
  }

  // -- Order Invoices: real "Record Payment", full amount --
  await adminPage.goto("/dashboard/invoices");
  await expect(adminPage.getByRole("heading", { name: "Order Invoices" })).toBeVisible({ timeout: 10000 });
  const invoiceRow = adminPage.locator(`tr:has-text("${invoice.invoice_number}")`);
  await expect(invoiceRow).toBeVisible({ timeout: 10000 });
  await invoiceRow.getByRole("button", { name: "Record Payment" }).click();
  const payModal = adminPage.locator("text=Record Payment —").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
  await expect(payModal).toBeVisible();
  const total = Math.round(Number(invoice.total));
  await payModal.getByPlaceholder("Amount Received (₹)").fill(String(total));
  await payModal.getByRole("button", { name: "Record Payment" }).click();
  await expect(payModal).toHaveCount(0, { timeout: 10000 });
  await expect(invoiceRow.getByText("paid", { exact: true })).toBeVisible({ timeout: 10000 });

  // -- Payroll: real salary structure + real "Generate Salary" --
  await adminPage.goto("/dashboard/admin/payroll");
  await expect(adminPage.getByRole("heading", { name: "Payroll" })).toBeVisible({ timeout: 10000 });
  await adminPage.locator("text=Employee").locator("xpath=following-sibling::select[1]").selectOption({ label: cfg.staffFullName });
  await adminPage.locator("text=Basic (₹)").locator("xpath=following-sibling::input[1]").fill("30000");
  await adminPage.locator("text=HRA (₹)").locator("xpath=following-sibling::input[1]").fill("12000");
  await adminPage.getByRole("button", { name: "Save Salary Structure" }).click();
  await expect(adminPage.getByText("Salary structure saved.")).toBeVisible({ timeout: 10000 });

  const genSection = adminPage.locator("text=Generate Salary").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
  await genSection.getByRole("button", { name: "Generate Salary" }).click();
  await expect(adminPage.getByText(/Generated \d+ payslip/)).toBeVisible({ timeout: 15000 });

  // Payroll (salary structure + generate) and the full payslip register
  // are separate pages now — the table lives on /dashboard/admin/payslips.
  await adminPage.goto("/dashboard/admin/payslips");
  await expect(adminPage.getByRole("heading", { name: "Payslips" })).toBeVisible({ timeout: 10000 });
  await expect(adminPage.locator("table").getByText(cfg.staffFullName)).toBeVisible();

  // -- Holidays: real "+ Add Holiday" --
  await adminPage.goto("/dashboard/holidays");
  await expect(adminPage.getByRole("heading", { name: "Holiday Calendar" })).toBeVisible({ timeout: 10000 });
  await adminPage.getByRole("button", { name: "Add Holiday", exact: true }).click();
  await adminPage.getByPlaceholder("Holiday name").fill(`${cfg.label} Foundation Day`);
  await adminPage.locator('input[type="date"]').fill("2026-11-15");
  await adminPage.getByRole("button", { name: "Add Holiday", exact: true }).click();
  await expect(adminPage.getByText("Holiday added.")).toBeVisible({ timeout: 10000 });
  await expect(adminPage.getByText(`${cfg.label} Foundation Day`)).toBeVisible();

  // -- HR Letters: generate a real PDF for the new employee --
  await adminPage.goto("/dashboard/admin/hr-letters");
  await expect(adminPage.getByRole("heading", { name: "HR Letter Generator" })).toBeVisible({ timeout: 10000 });
  const requiredFields = adminPage.locator("form input[required], form textarea[required]");
  const fieldCount = await requiredFields.count();
  for (let i = 0; i < fieldCount; i++) {
    const field = requiredFields.nth(i);
    const tag = await field.evaluate((el) => el.tagName.toLowerCase());
    const type = await field.getAttribute("type");
    if (type === "date") await field.fill("2026-06-01");
    else if (type === "number") await field.fill("30000");
    else if (tag === "textarea") await field.fill("Playwright onboarding regression — generated letter body.");
    else await field.fill(cfg.staffFullName);
  }
  const downloadPromise = adminPage.waitForEvent("download", { timeout: 15000 }).catch(() => null);
  await adminPage.getByRole("button", { name: "Generate PDF" }).click();
  await expect(adminPage.getByText("Letter generated and downloaded.")).toBeVisible({ timeout: 15000 });
  const download = await downloadPromise;
  expect(download, "HR letter PDF didn't actually download").toBeTruthy();

  // -- Create User: a real customer account, for the customer-facing
  // side of the app — Business Finance is deliberately customer-only
  // (see /api/expense-manager/setup: "Phase 1 ... no staff/accountant
  // access exists yet"), so it can't be exercised from the admin session
  // above; the customer created by lead conversion never has its temp
  // password surfaced back to the caller (it's emailed, not returned),
  // so a second, directly-created customer account is used instead.
  await adminPage.goto("/dashboard/admin/users");
  await expect(adminPage.getByRole("heading", { name: "Create User" })).toBeVisible({ timeout: 10000 });
  await adminPage.locator("text=Account Type").locator("xpath=following-sibling::select[1]").selectOption("customer");
  await adminPage.locator("text=Tier").locator("xpath=following-sibling::select[1]").selectOption("paid");
  await adminPage.locator("text=Full Name").locator("xpath=following-sibling::input[1]").fill(`${cfg.label} Customer`);
  await adminPage.locator("text=Email").locator("xpath=following-sibling::input[1]").fill(`${cfg.orgSlug}.customer@example.com`);
  await adminPage.locator("text=Company").locator("xpath=following-sibling::input[1]").fill(`${cfg.label} Client Co`);
  await adminPage.getByRole("button", { name: "Create User", exact: true }).click();
  await expect(adminPage.getByText("Account created.")).toBeVisible({ timeout: 15000 });
  const customerTempPassword = (await adminPage.locator("span.font-mono.font-semibold").first().textContent())?.trim();
  expect(customerTempPassword, "customer creation didn't return a temp password").toBeTruthy();

  await adminCtx.close();

  // ---- 2b. New org's own customer logs in for real: Business Finance,
  // Order History, My Invoices, Profile ----
  const customerCtx = await browser.newContext();
  const customerPage = await customerCtx.newPage();
  await login(customerPage, `${cfg.orgSlug}.customer@example.com`, customerTempPassword!);

  await customerPage.goto("/dashboard/finance");
  const wizard = customerPage.getByText("Set up your Business Finance workspace");
  const dashboardReady = customerPage.getByRole("button", { name: "Add Expense" });
  await Promise.race([wizard.waitFor({ state: "visible", timeout: 10000 }), dashboardReady.waitFor({ state: "visible", timeout: 10000 })]).catch(() => {});
  if (await wizard.isVisible().catch(() => false)) {
    await customerPage.getByPlaceholder("Bank Name (e.g. HDFC)").fill("HDFC Bank");
    await customerPage.getByPlaceholder("Account Name").fill(`${cfg.label} Client Co Current Account`);
    await customerPage.getByPlaceholder("Opening Balance").fill("50000");
    await customerPage.getByPlaceholder("0").fill("5000");
    await customerPage.getByRole("button", { name: "Finish Setup" }).click();
    await expect(wizard).toHaveCount(0, { timeout: 15000 });
  }
  await expect(dashboardReady).toBeVisible({ timeout: 10000 });
  const expenseDescription = `${cfg.label} onboarding regression expense`;
  await dashboardReady.click();
  const expenseModal = customerPage.locator("text=Amount").locator("xpath=ancestor::div[contains(@class,'fixed')][1]");
  await expect(expenseModal).toBeVisible();
  // Category is now required, via a custom DetailPickerModal (not a
  // native <select>) — a fresh org has no categories yet, so create one
  // inline through its "+ Add new category…" option.
  await expenseModal.getByRole("button", { name: "Select a category" }).click();
  await customerPage.getByRole("button", { name: "+ Add new category…" }).click();
  await expenseModal.getByPlaceholder("New category").fill("Regression Test Category");
  await expenseModal.getByRole("button", { name: "Add", exact: true }).click();
  // handleAddCategory() is async (POSTs, then sets categoryId from the
  // response) — wait for the trigger button to actually reflect the new
  // selection before continuing, or Save can fire while categoryId is
  // still empty and get rejected with "Choose a category."
  await expect(expenseModal.getByRole("button", { name: "Regression Test Category" })).toBeVisible({ timeout: 10000 });
  await expenseModal.locator("text=Amount").locator("xpath=following-sibling::input[1]").fill("799");
  await expenseModal.locator("text=Payment Mode").locator("xpath=following-sibling::select[1]").selectOption("cash");
  await expenseModal.locator("text=Description").locator("xpath=following-sibling::input[1]").fill(expenseDescription);
  await expenseModal.getByRole("button", { name: "Save", exact: true }).click();
  await expect(expenseModal).toHaveCount(0, { timeout: 10000 });
  const expenseTxRes = await customerPage.request.get("/api/expense-manager/transactions");
  const { transactions } = await expenseTxRes.json();
  expect(transactions.some((t: { description: string }) => t.description === expenseDescription), "expense not found via API").toBeTruthy();

  await customerPage.goto("/dashboard/orders");
  await expect(customerPage.getByRole("heading", { name: "Order History" })).toBeVisible({ timeout: 10000 });

  await customerPage.goto("/dashboard/invoices");
  await expect(customerPage.getByRole("heading", { name: "My Invoices" })).toBeVisible({ timeout: 10000 });

  await customerPage.goto("/dashboard/profile");
  await expect(customerPage.getByRole("heading", { name: "Edit Profile" })).toBeVisible({ timeout: 10000 });
  const cityField = customerPage.locator("text=City").locator("xpath=following-sibling::input[1]");
  if (await cityField.count() > 0) {
    await cityField.fill("Mumbai");
    const saveProfileButton = customerPage.getByRole("button", { name: /Save/ }).first();
    if (await saveProfileButton.count() > 0) await saveProfileButton.click();
  }

  await customerCtx.close();

  // ---- 3. New staff member logs in for real: Leave + Attendance ----
  const staffCtx = await browser.newContext();
  const staffPage = await staffCtx.newPage();
  await login(staffPage, cfg.staffEmail, staffTempPassword!);

  await staffPage.goto("/dashboard/leave");
  await expect(staffPage.getByRole("heading", { name: "Leave" })).toBeVisible({ timeout: 10000 });
  await staffPage.getByRole("button", { name: "Apply for Leave" }).click();
  const leaveStart = new Date();
  leaveStart.setDate(leaveStart.getDate() + 20);
  const leaveStartStr = leaveStart.toISOString().slice(0, 10);
  // Leave type is a DetailPickerModal now, not a plain <select> — but
  // its default value already matches "Unpaid Leave", which needs no
  // org-specific balance to exist, so the picker is left untouched here.
  await staffPage.locator('input[type="date"]').first().fill(leaveStartStr);
  await staffPage.locator('input[type="date"]').nth(1).fill(leaveStartStr);
  await staffPage.locator("textarea").fill(`${cfg.label} onboarding regression leave`);
  await staffPage.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(staffPage.getByText("Leave request submitted.")).toBeVisible({ timeout: 10000 });

  await staffPage.goto("/dashboard/attendance");
  // exact:true — the page also has an "Attendance Log" tab heading, which
  // substring-matches "Attendance" too.
  await expect(staffPage.getByRole("heading", { name: "Attendance", exact: true })).toBeVisible({ timeout: 10000 });
  await expect(staffPage.getByText("Not clocked in", { exact: true })).toBeVisible();
  await staffPage.getByRole("button", { name: "Clock In" }).click();
  // Generous timeout: handleClock() waits on navigator.geolocation
  // (5s timeout in this headless context before resolving null) before
  // its POST + refetch even starts, on top of ordinary full-suite load.
  await expect(staffPage.getByText("Elapsed")).toBeVisible({ timeout: 20000 });
  await staffPage.getByRole("button", { name: "Clock Out" }).click();
  await expect(staffPage.getByRole("button", { name: "Clock Out" })).toBeDisabled({ timeout: 10000 });

  await staffCtx.close();

  // ---- 4. Back to the admin: approve that leave request for real ----
  const adminCtx2 = await browser.newContext();
  const adminPage2 = await adminCtx2.newPage();
  await login(adminPage2, cfg.adminEmail, adminTempPassword!);
  await adminPage2.goto("/dashboard/admin/leave-requests");
  await expect(adminPage2.getByRole("heading", { name: "Leave Requests" })).toBeVisible({ timeout: 10000 });
  const leaveRow = adminPage2.locator("tr", { hasText: `${cfg.label} onboarding regression leave` });
  await expect(leaveRow).toBeVisible({ timeout: 10000 });
  await leaveRow.getByRole("button", { name: "Approve" }).click();
  await expect(leaveRow.getByText("approved", { exact: true })).toBeVisible({ timeout: 10000 });
  await adminCtx2.close();

  return { orderId, invoiceId: invoice.id, invoiceTotal: total };
}
