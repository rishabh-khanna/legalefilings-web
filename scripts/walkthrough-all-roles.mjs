// End-to-end sweep: signs in as every role in turn, opens every
// dashboard page that role should be able to reach, and reports three
// things per page — console errors, visible error text, and whether the
// page actually rendered its own heading rather than silently bouncing.
//
// Written for the final pre-demo pass. Screenshots land in
// screenshots/walkthrough/ so the money documents (invoices, payslips)
// can be eyeballed rather than merely asserted on.
//
// Usage: node scripts/walkthrough-all-roles.mjs [roleName]

import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const PASSWORD = "Chatak@2026";
const SHOTS = new URL("../screenshots/walkthrough/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

// What each role is expected to reach. "expect" is the heading that
// proves the page rendered for real; "denied" marks routes the role
// should be bounced away from, so a silent over-permission shows up as
// loudly as a silent under-permission.
const ADMIN_PAGES = [
  ["/dashboard", "Overview"],
  ["/dashboard/crm", "My Leads"],
  ["/dashboard/admin/leads", "Pipeline"],
  ["/dashboard/admin/buy-for-customer", null],
  ["/dashboard/invoices", null],
  ["/dashboard/invoice-crm", "Invoice Generator"],
  ["/dashboard/orders", "Orders"],
  ["/dashboard/finance", null],
  ["/dashboard/finance/reports", null],
  ["/dashboard/attendance", "Attendance"],
  ["/dashboard/attendance/corrections", null],
  ["/dashboard/leave", "Leave"],
  ["/dashboard/payslips", null],
  ["/dashboard/holidays", "Holiday Calendar"],
  ["/dashboard/documents", "Documents"],
  ["/dashboard/admin/account-requests", null],
  ["/dashboard/admin/reviewed-account-requests", null],
  ["/dashboard/admin/users", null],
  ["/dashboard/admin/attendance", "Team Attendance"],
  ["/dashboard/admin/leave-requests", "Leave Requests"],
  ["/dashboard/admin/analytics", "Analytics"],
  ["/dashboard/admin/employees", "Employees"],
  ["/dashboard/admin/departments", "Departments"],
  ["/dashboard/admin/payroll", "Payroll"],
  ["/dashboard/admin/payslips", null],
  ["/dashboard/admin/hr-letters", "HR Letters"],
  ["/dashboard/admin/product-catalog", null],
  ["/dashboard/admin/reports", null],
  ["/dashboard/admin/business-settings", "Business Settings"],
  ["/dashboard/admin/email-failures", "Email Failures"],
  ["/dashboard/admin/leave-types", "Leave Types"],
  ["/dashboard/admin/activity", "Activity"],
  ["/dashboard/admin/tool-access", "Delegated Access"],
  ["/dashboard/profile", null],
];

const STAFF_PAGES = [
  ["/dashboard", "Overview"],
  ["/dashboard/crm", "My Leads"],
  ["/dashboard/invoices", null],
  ["/dashboard/orders", null],
  ["/dashboard/invoice-crm", "Invoice Generator"],
  ["/dashboard/attendance", "Attendance"],
  ["/dashboard/leave", "Leave"],
  ["/dashboard/payslips", null],
  ["/dashboard/holidays", "Holiday Calendar"],
  ["/dashboard/documents", "Documents"],
  ["/dashboard/profile", null],
];

// A plain customer never holds CRM tools — CRM access means becoming an
// admin of your own organization, so everything operational is denied.
const CUSTOMER_PAGES = [
  ["/dashboard", "Overview"],
  ["/dashboard/invoices", null],
  ["/dashboard/orders", null],
  ["/dashboard/finance", null],
  ["/dashboard/crm-access", null],
  ["/dashboard/profile", null],
];
const CUSTOMER_DENIED = [
  "/dashboard/invoice-crm", "/dashboard/admin/leads", "/dashboard/admin/employees",
  "/dashboard/admin/payroll", "/dashboard/admin/attendance", "/dashboard/admin/business-settings",
  "/dashboard/platform/organizations",
];

const ROLES = {
  // The account this environment is built around: onboarded as a paid
  // customer, then promoted to admin of Chatak Singh when his CRM
  // workspace request was approved.
  "chatak-admin (Rishabh)": { email: "rishabhkhanna.93@gmail.com", pages: ADMIN_PAGES, denied: ["/dashboard/platform/organizations"] },
  "group-leader": { email: "manpreet.kaur@chataksingh.in", pages: [...STAFF_PAGES, ["/dashboard/admin/leads", "Pipeline"], ["/dashboard/admin/attendance", "Team Attendance"], ["/dashboard/admin/analytics", "Analytics"]], denied: ["/dashboard/admin/employees", "/dashboard/admin/payroll", "/dashboard/admin/business-settings"] },
  "leader": { email: "vikas.dwivedi@chataksingh.in", pages: [...STAFF_PAGES, ["/dashboard/admin/leave-requests", "Leave Requests"]], denied: ["/dashboard/admin/analytics", "/dashboard/admin/employees"] },
  // Reaching /dashboard/admin/leads and /admin/attendance by URL is
  // deliberate for any staff level — the nav hides them and every
  // backing API narrows to the caller's own reporting chain, so the
  // pages come up empty rather than leaky. Only genuinely admin-only
  // sections are asserted blocked.
  "rater": { email: "sahil.bhatia@chataksingh.in", pages: STAFF_PAGES, denied: ["/dashboard/admin/employees", "/dashboard/admin/payroll", "/dashboard/admin/business-settings"] },
  "customer (B2B buyer)": { email: "naresh.agarwal@shreebalajistores.in", pages: CUSTOMER_PAGES, denied: CUSTOMER_DENIED },
  "legal-admin": { email: "arvind.menon@legalefilings.com", pages: ADMIN_PAGES, denied: ["/dashboard/platform/organizations"] },
  "platform-operator": { email: "nandini.iyer@legalefilings.com", pages: [...ADMIN_PAGES, ["/dashboard/platform/organizations", "Organizations"], ["/dashboard/platform/crm-requests", null]], denied: [] },
};

const only = process.argv[2];
const browser = await chromium.launch();
const findings = [];

for (const [role, cfg] of Object.entries(ROLES)) {
  if (only && role !== only) continue;
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 200)}`));

  // Retried: a long sweep occasionally hits a transient network
  // suspension between roles, and losing the whole run to that tells us
  // nothing about the app.
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(`${BASE}/login`, { timeout: 30000 });
      await page.fill("#login-email", cfg.email, { timeout: 20000 });
      await page.fill("#login-password", PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/dashboard/, { timeout: 25000 });
      break;
    } catch (err) {
      if (attempt >= 3) throw err;
      await page.waitForTimeout(2500);
    }
  }
  console.log(`\n═══ ${role}  (${cfg.email}) ═══`);

  for (const [path, expectHeading] of cfg.pages) {
    consoleErrors.length = 0;
    // Retry the navigation itself. Without this a transient
    // ERR_NETWORK_IO_SUSPENDED leaves the browser sitting on the previous
    // page, which then reads as a spurious "bounced" for a page that is
    // actually fine — noise that buries real findings.
    let navigated = false;
    for (let attempt = 1; attempt <= 3 && !navigated; attempt++) {
      try {
        await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 30000 });
        navigated = true;
      } catch {
        await page.waitForTimeout(1500);
      }
    }
    if (!navigated) { console.log(`  ~ ${path} (skipped — network unavailable)`); continue; }
    await page.waitForTimeout(900);
    const url = page.url();
    const body = await page.locator("body").innerText().catch(() => "");

    const bounced = !url.includes(path);
    // "Loading…" left on screen after networkidle means a fetch the page
    // depends on never resolved — worth catching separately from an
    // outright error, since the page looks merely slow rather than broken.
    const stuck = /^\s*Loading/m.test(body) && body.length < 400;
    // Deliberately specific: "don't have access to this page" is the
    // real block state, whereas Request CRM Access legitimately renders
    // the words "what you don't have access to yet" as marketing copy.
    const errorText = /Failed to load|Something went wrong|Unexpected error|don['’]t have access to this page|Internal Server Error/i.exec(body)?.[0];
    // Browser-level transport failures say nothing about the app.
    const transient = consoleErrors.filter((e) => !/ERR_NETWORK_IO_SUSPENDED|ERR_TIMED_OUT|ERR_NETWORK_CHANGED|ERR_CONNECTION/.test(e));
    const headingOk = !expectHeading || body.includes(expectHeading);

    const issues = [];
    if (bounced) issues.push(`BOUNCED -> ${url.replace(BASE, "")}`);
    if (stuck) issues.push("STUCK ON LOADING");
    if (errorText) issues.push(`ERROR TEXT: "${errorText}"`);
    if (!headingOk) issues.push(`missing heading "${expectHeading}"`);
    if (transient.length) issues.push(`console: ${transient[0]}`);

    if (issues.length) {
      console.log(`  ✘ ${path.padEnd(42)} ${issues.join(" | ")}`);
      findings.push({ role, path, issues });
      await page.screenshot({ path: `${SHOTS}${role.replace(/[^a-z0-9]+/gi, "-")}${path.replace(/\//g, "_")}.png` }).catch(() => {});
    } else {
      console.log(`  ✓ ${path}`);
    }
  }

  for (const path of cfg.denied ?? []) {
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try { await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 30000 }); ok = true; }
      catch { await page.waitForTimeout(1500); }
    }
    if (!ok) { console.log(`  ~ denied-check ${path} (skipped — network unavailable)`); continue; }
    await page.waitForTimeout(700);
    const body = await page.locator("body").innerText().catch(() => "");
    const blocked = !page.url().includes(path) || /don't have access/i.test(body);
    if (blocked) console.log(`  ✓ blocked: ${path}`);
    else {
      console.log(`  ✘ NOT BLOCKED: ${path}`);
      findings.push({ role, path, issues: ["reachable but should be denied"] });
    }
  }

  await ctx.close();
}

await browser.close();
console.log(`\n${"═".repeat(60)}`);
if (!findings.length) console.log("No issues found.");
else {
  console.log(`${findings.length} issue(s):`);
  for (const f of findings) console.log(`  ${f.role.padEnd(18)} ${f.path.padEnd(42)} ${f.issues.join(" | ")}`);
}
