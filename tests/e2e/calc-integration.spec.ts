import { test, expect } from "@playwright/test";
import { calculatePayroll, computeLopDays } from "../../src/lib/payroll";
import { workingDaysInMonth } from "../../src/lib/working-days";
import { getDbAdmin } from "./helpers/db-admin";

// calc-invoice.spec.ts and calc-payroll.spec.ts verify the pure math
// functions in isolation. These tests verify the actual WIRING: that a
// real invoice created through the real API, and a real payslip
// generated from real seeded attendance/leave rows, land on the exact
// numbers those same pure functions predict — not just that the fields
// are populated.
test.use({ storageState: "tests/e2e/.auth/admin.json" });

test.describe("Invoice creation — real API, hand-verified totals", () => {
  test("inter-state GST invoice: 2 line items, 10% invoice discount, 2% TDS, freight — every stored total matches the worked-out math", async ({ request }) => {
    // Arvind Menon's org (company_settings) is Delhi, state_code 07 — a
    // customer in a DIFFERENT state forces IGST, not CGST+SGST.
    const suffix = Date.now();
    const customerRes = await request.post("/api/admin/create-user", {
      data: {
        fullName: `Calc Test Customer ${suffix}`,
        email: `calc-test-customer-${suffix}@example.com`,
        accountType: "customer",
        customerTier: "paid",
        state: "Karnataka",
        stateCode: "29",
      },
    });
    expect(customerRes.ok(), await customerRes.text()).toBeTruthy();
    const { userId: customerId } = await customerRes.json();

    // Item A: 1 x ₹10,000 @ 18% GST -> taxable 10,000, GST 1,800 (all IGST, inter-state)
    // Item B: 2 x ₹1,500 @ 12% GST -> taxable 3,000, GST 360 (all IGST)
    // subtotal = 13,000; raw IGST = 2,160
    // 10% invoice discount -> discountAmount = 1,300; discountFactor = 0.9
    // igstTotal = 2,160 * 0.9 = 1,944
    // otherChargesTotal = freight 500
    // invoiceValue = 13,000 - 1,300 + 1,944 + 500 = 14,144
    // TDS base = 13,000 - 1,300 = 11,700; TDS @ 2% = 234
    // netReceivable = 14,144 - 234 = 13,910
    const invoiceRes = await request.post("/api/invoices", {
      data: {
        customerId,
        invoiceType: "gst",
        items: [
          { description: "Consulting", hsnSacCode: "9983", itemType: "service", unit: "Nos", quantity: 1, rate: 10000, discount: 0, gstRate: 18 },
          { description: "Filing Fee", hsnSacCode: "9983", itemType: "service", unit: "Nos", quantity: 2, rate: 1500, discount: 0, gstRate: 12 },
        ],
        discountType: "percentage",
        discountValue: 10,
        freight: 500,
        packing: 0,
        courier: 0,
        otherCharges: 0,
        tdsRate: 2,
        customerState: "Karnataka",
        customerStateCode: "29",
      },
    });
    expect(invoiceRes.ok(), await invoiceRes.text()).toBeTruthy();
    const { invoice } = await invoiceRes.json();

    expect(Number(invoice.subtotal)).toBe(13000);
    expect(Number(invoice.discount_amount)).toBe(1300);
    expect(Number(invoice.cgst_total)).toBe(0);
    expect(Number(invoice.sgst_total)).toBe(0);
    expect(Number(invoice.igst_total)).toBe(1944);
    expect(Number(invoice.tax_amount)).toBe(1944);
    expect(Number(invoice.total)).toBe(14144);
    expect(Number(invoice.tds_amount)).toBe(234);
  });

  test("intra-state GST invoice (same state as the company): tax splits into CGST + SGST, not IGST", async ({ request }) => {
    const suffix = Date.now();
    const customerRes = await request.post("/api/admin/create-user", {
      data: {
        fullName: `Calc Intrastate Customer ${suffix}`,
        email: `calc-intrastate-customer-${suffix}@example.com`,
        accountType: "customer",
        customerTier: "paid",
        state: "Delhi", // same state as the company (company_settings.state_code 07)
        stateCode: "07",
      },
    });
    expect(customerRes.ok(), await customerRes.text()).toBeTruthy();
    const { userId: customerId } = await customerRes.json();

    // 1 x ₹4,000 @ 18% GST, no discount, no TDS.
    // taxable = 4,000; GST = 720, split 360 CGST / 360 SGST.
    const invoiceRes = await request.post("/api/invoices", {
      data: {
        customerId,
        invoiceType: "gst",
        items: [{ description: "Registration Fee", hsnSacCode: "9983", itemType: "service", unit: "Nos", quantity: 1, rate: 4000, discount: 0, gstRate: 18 }],
        discountType: null,
        discountValue: 0,
        freight: 0,
        packing: 0,
        courier: 0,
        otherCharges: 0,
        tdsRate: 0,
        customerState: "Delhi",
        customerStateCode: "07",
      },
    });
    expect(invoiceRes.ok(), await invoiceRes.text()).toBeTruthy();
    const { invoice } = await invoiceRes.json();

    expect(Number(invoice.cgst_total)).toBe(360);
    expect(Number(invoice.sgst_total)).toBe(360);
    expect(Number(invoice.igst_total)).toBe(0);
    expect(Number(invoice.total)).toBe(4720);
  });

  test("a non-GST invoice type charges zero tax regardless of the line items' gstRate", async ({ request }) => {
    const suffix = Date.now();
    const customerRes = await request.post("/api/admin/create-user", {
      data: { fullName: `Calc NonGst Customer ${suffix}`, email: `calc-nongst-customer-${suffix}@example.com`, accountType: "customer", customerTier: "paid" },
    });
    expect(customerRes.ok(), await customerRes.text()).toBeTruthy();
    const { userId: customerId } = await customerRes.json();

    const invoiceRes = await request.post("/api/invoices", {
      data: {
        customerId,
        invoiceType: "non_gst",
        items: [{ description: "Service", quantity: 1, rate: 2000, discount: 0, gstRate: 18 }],
        discountType: null,
        discountValue: 0,
        freight: 0,
        packing: 0,
        courier: 0,
        otherCharges: 0,
        tdsRate: 0,
      },
    });
    expect(invoiceRes.ok(), await invoiceRes.text()).toBeTruthy();
    const { invoice } = await invoiceRes.json();
    expect(Number(invoice.tax_amount)).toBe(0);
    expect(Number(invoice.total)).toBe(2000);
  });
});

test.describe("Payroll generation — real seeded attendance/leave, hand-verified payslip", () => {
  test("mixed attendance (present + full paid leave + half paid leave + LOP) produces a payslip matching calculatePayroll/computeLopDays exactly", async ({ request }) => {
    test.setTimeout(30000);
    const suffix = Date.now();
    const MONTH = 5;
    const YEAR = 2097; // far future — guaranteed no pre-existing data

    // Independently enumerate this month's weekdays (not via src/lib) so
    // the test doesn't validate the implementation against itself.
    const weekdays: string[] = [];
    for (let day = 1; day <= 31; day++) {
      const d = new Date(Date.UTC(YEAR, MONTH - 1, day));
      if (d.getUTCMonth() !== MONTH - 1) break;
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6) weekdays.push(d.toISOString().slice(0, 10));
    }
    expect(weekdays.length).toBeGreaterThan(10);

    const createRes = await request.post("/api/admin/create-user", {
      data: { fullName: `Calc Payroll Staff ${suffix}`, email: `calc-payroll-staff-${suffix}@example.com`, accountType: "staff", department: "Playwright QA", designation: "Test Staff" },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const { userId: staffId } = await createRes.json();

    const structureRes = await request.post("/api/payroll/salary-structure", {
      data: { staffId, basic: 20000, hra: 8000, specialAllowance: 2000, bonus: 0, incentives: 0, effectiveFrom: `${YEAR}-01-01` },
    });
    expect(structureRes.ok(), await structureRes.text()).toBeTruthy();

    // Present: first 3 weekdays (real check_in events). Noon UTC so IST
    // (UTC+5:30) conversion can never shift it onto a different calendar day.
    const presentDays = weekdays.slice(0, 3);
    // Full paid leave: next 2 weekdays.
    const fullLeaveDays = weekdays.slice(3, 5);
    // Half paid leave: next 1 weekday.
    const halfLeaveDay = weekdays[5];
    // Everything else in the month is uncovered -> Loss of Pay.

    const db = getDbAdmin();
    const { data: staffProfile } = await db.from("profiles").select("organization_id").eq("id", staffId).single();
    const organizationId = staffProfile!.organization_id as string;

    const { error: attendanceError } = await db.from("attendance_events").insert(
      presentDays.map((date) => ({ staff_id: staffId, organization_id: organizationId, event_type: "check_in", occurred_at: `${date}T12:00:00Z` }))
    );
    expect(attendanceError, attendanceError?.message).toBeNull();

    const { error: fullLeaveError } = await db.from("leave_requests").insert(
      fullLeaveDays.map((date) => ({
        staff_id: staffId,
        organization_id: organizationId,
        leave_type: "casual",
        start_date: date,
        end_date: date,
        status: "approved",
        day_fraction: 1,
      }))
    );
    expect(fullLeaveError, fullLeaveError?.message).toBeNull();

    const { error: halfLeaveError } = await db.from("leave_requests").insert({
      staff_id: staffId,
      organization_id: organizationId,
      leave_type: "sick",
      start_date: halfLeaveDay,
      end_date: halfLeaveDay,
      status: "approved",
      day_fraction: 0.5,
    });
    expect(halfLeaveError, halfLeaveError?.message).toBeNull();

    const generateRes = await request.post("/api/payroll/generate", { data: { month: MONTH, year: YEAR } });
    expect(generateRes.ok(), await generateRes.text()).toBeTruthy();

    const payslipsRes = await request.get(`/api/payroll/payslips?staffId=${staffId}`);
    expect(payslipsRes.ok()).toBeTruthy();
    const { payslips } = await payslipsRes.json();
    const payslip = payslips.find((p: { month: number; year: number }) => p.month === MONTH && p.year === YEAR);
    expect(payslip, "no payslip generated for the seeded staff member").toBeTruthy();

    // Independently recompute the expected numbers with the same pure
    // functions the API itself calls, but fed with our OWN copies of
    // the present/leave sets (not re-reading them back from the DB) —
    // this proves the API correctly translated the seeded rows into
    // those sets (date-key conversion, leave_type filtering, org
    // scoping), not just that the formula is self-consistent.
    const holidays = new Set<string>(); // none declared for this far-future period
    const payableDays = workingDaysInMonth(MONTH, YEAR, holidays);
    const expectedLopDays = computeLopDays(
      MONTH,
      YEAR,
      new Set(presentDays),
      new Set([...fullLeaveDays, halfLeaveDay]),
      holidays,
      new Set([halfLeaveDay])
    );

    const businessSettingsRes = await request.get("/api/business-settings");
    const businessSettings = await businessSettingsRes.json();

    const expected = calculatePayroll({
      basic: 20000,
      hra: 8000,
      specialAllowance: 2000,
      bonus: 0,
      incentives: 0,
      lopDays: expectedLopDays,
      payableDays,
      state: businessSettings.state,
    });

    expect(Number(payslip.lop_days)).toBe(expectedLopDays);
    expect(Number(payslip.gross_salary)).toBe(expected.grossSalary);
    expect(Number(payslip.lop_deduction)).toBe(expected.lopDeduction);
    expect(Number(payslip.pf_deduction)).toBe(expected.pfDeduction);
    expect(Number(payslip.esi_deduction)).toBe(expected.esiDeduction);
    expect(Number(payslip.professional_tax)).toBe(expected.professionalTax);
    expect(Number(payslip.net_salary)).toBe(expected.netSalary);
  });
});
