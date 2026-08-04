// One-off seed script — populates the Supabase project with demo accounts
// across every role plus realistic leads/orders/invoices, so the dashboard
// and admin CRM board have real data to render instead of hardcoded mock
// arrays. Safe to re-run: upserts by email/known IDs where practical.
//
// Usage: node scripts/seed-database.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY in the env
// (already in .env.local — this script loads it manually since it runs
// outside Next.js).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

function loadEnvLocal() {
  try {
    const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) process.env[m[1]] ??= m[2];
    }
  } catch {
    // fine — env vars may already be set
  }
}
loadEnvLocal();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const DEMO_PASSWORD = "Demo@12345";

const DEMO_ACCOUNTS = [
  { email: "admin@legalefilings.com", full_name: "Asha Admin", account_type: "admin" },
  { email: "groupleader@legalefilings.com", full_name: "Gaurav Group Leader", account_type: "staff", staff_level: "group_leader" },
  { email: "leader@legalefilings.com", full_name: "Leena Leader", account_type: "staff", staff_level: "leader", reportsToEmail: "groupleader@legalefilings.com" },
  { email: "rater@legalefilings.com", full_name: "Rahul Rater", account_type: "staff", staff_level: "rater", reportsToEmail: "leader@legalefilings.com" },
  { email: "customer.free@legalefilings.com", full_name: "Ananya Sharma", account_type: "customer", customer_tier: "free", company: "Bloom Retail Pvt Ltd", city: "Mumbai", state: "Maharashtra", phone: "+91 98765 43210" },
  { email: "customer.paid@legalefilings.com", full_name: "Rohan Mehta", account_type: "customer", customer_tier: "paid", company: "Mehta Textiles", city: "Surat", state: "Gujarat", phone: "+91 91234 56780" },
];

async function upsertAuthUser(email, password) {
  const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = existing?.users?.find((u) => u.email === email);
  if (found) return found;
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  return data.user;
}

async function main() {
  console.log("Seeding demo accounts...");
  const idByEmail = {};
  for (const acc of DEMO_ACCOUNTS) {
    const user = await upsertAuthUser(acc.email, DEMO_PASSWORD);
    idByEmail[acc.email] = user.id;
    console.log(`  auth user ready: ${acc.email} -> ${user.id}`);
  }

  for (const acc of DEMO_ACCOUNTS) {
    const { error } = await supabase.from("profiles").upsert({
      id: idByEmail[acc.email],
      full_name: acc.full_name,
      phone: acc.phone ?? null,
      account_type: acc.account_type,
      customer_tier: acc.customer_tier ?? null,
      staff_level: acc.staff_level ?? null,
      reports_to: acc.reportsToEmail ? idByEmail[acc.reportsToEmail] : null,
      company: acc.company ?? null,
      city: acc.city ?? null,
      state: acc.state ?? null,
      crm_status: acc.account_type === "customer" ? "active" : "lead",
    });
    if (error) throw new Error(`profiles upsert (${acc.email}): ${error.message}`);
  }
  console.log("Profiles upserted.");

  const raterName = "Rahul Rater";
  const leaderName = "Leena Leader";

  console.log("Seeding leads...");
  const leadsPayload = [
    { name: "Priya Nair", company: "Nair & Co Consulting", email: "priya.nair@naircons.in", phone: "+91 90000 11223", city: "Kochi", state: "Kerala", service: "Trademark Registration", status: "new", assigned_to: raterName, source: "website_consultation_form" },
    { name: "Vikram Singh", company: "Singh Logistics", email: "vikram@singhlogistics.co.in", phone: "+91 99887 76655", city: "Ludhiana", state: "Punjab", service: "GST Registration", status: "contacted", assigned_to: raterName, source: "website_consultation_form" },
    { name: "Fatima Khan", company: "Khan Design Studio", email: "fatima@khandesign.studio", phone: "+91 93456 78901", city: "Lucknow", state: "Uttar Pradesh", service: "Private Limited Company Registration", status: "in_progress", assigned_to: leaderName, source: "website_consultation_form" },
    { name: "Suresh Iyer", company: "Iyer Exports", email: "suresh@iyerexports.in", phone: "+91 98111 22334", city: "Chennai", state: "Tamil Nadu", service: "IEC Registration", status: "won", assigned_to: leaderName, source: "website_consultation_form" },
    { name: "Meena Joshi", company: null, email: "meena.joshi@gmail.com", phone: "+91 97000 44556", city: "Pune", state: "Maharashtra", service: "GST Registration", status: "lost", assigned_to: raterName, source: "website_consultation_form" },
  ];
  for (const lead of leadsPayload) {
    // leads.email has no unique constraint, so upsert-by-email isn't available —
    // insert-if-not-exists instead.
    const { data: existing } = await supabase.from("leads").select("id").eq("email", lead.email).maybeSingle();
    if (!existing) {
      const { error } = await supabase.from("leads").insert(lead);
      if (error) throw new Error(`leads insert (${lead.email}): ${error.message}`);
    }
  }
  console.log("Leads seeded.");

  console.log("Seeding orders + invoices...");
  const freeCustomerId = idByEmail["customer.free@legalefilings.com"];
  const paidCustomerId = idByEmail["customer.paid@legalefilings.com"];

  const ordersPayload = [
    { customer_id: freeCustomerId, service: "Private Limited Company", plan: "Standard", plan_price: 11999, status: "completed", assigned_to: idByEmail["leader@legalefilings.com"] },
    { customer_id: freeCustomerId, service: "GST Registration", plan: "Basic", plan_price: 1999, status: "completed", assigned_to: idByEmail["rater@legalefilings.com"] },
    { customer_id: paidCustomerId, service: "Trademark Registration", plan: "Standard", plan_price: 6500, status: "in_progress", assigned_to: idByEmail["rater@legalefilings.com"] },
    { customer_id: paidCustomerId, service: "Annual Compliance", plan: "Full Year", plan_price: 14999, status: "under_review", assigned_to: idByEmail["leader@legalefilings.com"] },
  ];

  const { data: existingOrders } = await supabase.from("orders").select("id, customer_id, service").limit(200);
  const orderIds = [];
  for (const order of ordersPayload) {
    const dup = existingOrders?.find((o) => o.customer_id === order.customer_id && o.service === order.service);
    if (dup) {
      orderIds.push(dup.id);
      continue;
    }
    const { data, error } = await supabase.from("orders").insert(order).select().single();
    if (error) throw new Error(`orders insert: ${error.message}`);
    orderIds.push(data.id);
  }
  console.log("Orders seeded.");

  const { data: existingInvoices } = await supabase.from("invoices").select("id, order_id");
  const invoicesPayload = [
    { order_id: orderIds[0], customer_id: freeCustomerId, invoice_number: "INV-1042", subtotal: 11999, tax_amount: 0, total: 11999, status: "paid", items: [{ description: "Private Limited Company Registration", quantity: 1, unit_price: 11999, amount: 11999 }] },
    { order_id: orderIds[1], customer_id: freeCustomerId, invoice_number: "INV-1043", subtotal: 1999, tax_amount: 0, total: 1999, status: "paid", items: [{ description: "GST Registration — Basic", quantity: 1, unit_price: 1999, amount: 1999 }] },
    { order_id: orderIds[2], customer_id: paidCustomerId, invoice_number: "INV-1044", subtotal: 6500, tax_amount: 0, total: 6500, status: "sent", items: [{ description: "Trademark Registration — Filing Fee", quantity: 1, unit_price: 6500, amount: 6500 }] },
  ];
  for (const inv of invoicesPayload) {
    if (existingInvoices?.some((e) => e.order_id === inv.order_id)) continue;
    const { items, ...invoiceRow } = inv;
    const { data, error } = await supabase.from("invoices").insert(invoiceRow).select().single();
    if (error) throw new Error(`invoices insert: ${error.message}`);
    for (const item of items) {
      await supabase.from("invoice_line_items").insert({ invoice_id: data.id, ...item });
    }
  }
  console.log("Invoices seeded.");

  console.log("Seeding employee master fields...");
  const staffProfiles = [
    { email: "admin@legalefilings.com", employee_id: "EMP-202601-0001", department: "Management", designation: "Founder & CEO", date_of_joining: "2021-04-01", bank_name: "HDFC Bank", bank_account_number: "50100234567890", bank_ifsc: "HDFC0001234", uan_number: "101234567890", esic_number: "3112345678000001", emergency_contact_name: "Asha's Spouse", emergency_contact_phone: "+91 90000 00001" },
    { email: "groupleader@legalefilings.com", employee_id: "EMP-202602-0002", department: "Operations", designation: "Group Leader — Compliance", date_of_joining: "2022-01-10", bank_name: "ICICI Bank", bank_account_number: "60200345678901", bank_ifsc: "ICIC0002345", uan_number: "101234567891", esic_number: "3112345678000002", emergency_contact_name: "Gaurav's Parent", emergency_contact_phone: "+91 90000 00002" },
    { email: "leader@legalefilings.com", employee_id: "EMP-202603-0003", department: "Compliance", designation: "Team Leader — ROC Filings", date_of_joining: "2022-08-15", bank_name: "Axis Bank", bank_account_number: "91100456789012", bank_ifsc: "UTIB0003456", uan_number: "101234567892", esic_number: "3112345678000003", emergency_contact_name: "Leena's Spouse", emergency_contact_phone: "+91 90000 00003" },
    { email: "rater@legalefilings.com", employee_id: "EMP-202604-0004", department: "Compliance", designation: "Compliance Associate", date_of_joining: "2023-03-20", bank_name: "State Bank of India", bank_account_number: "31200567890123", bank_ifsc: "SBIN0004567", uan_number: "101234567893", esic_number: "3112345678000004", emergency_contact_name: "Rahul's Parent", emergency_contact_phone: "+91 90000 00004" },
  ];
  const staffIds = staffProfiles.map((s) => idByEmail[s.email]);
  for (const s of staffProfiles) {
    const { email, ...fields } = s;
    const { error } = await supabase.from("profiles").update(fields).eq("id", idByEmail[email]);
    if (error) throw new Error(`profiles employee-fields update (${email}): ${error.message}`);
  }
  console.log("Employee master fields seeded.");

  console.log("Seeding attendance events...");
  const today = new Date();
  for (let daysAgo = 1; daysAgo <= 5; daysAgo++) {
    const day = new Date(today);
    day.setDate(day.getDate() - daysAgo);
    if (day.getDay() === 0 || day.getDay() === 6) continue; // skip weekends
    for (const staffId of staffIds) {
      const checkIn = new Date(day);
      checkIn.setHours(9, 30 + Math.floor(Math.random() * 20), 0, 0);
      const checkOut = new Date(day);
      checkOut.setHours(18, Math.floor(Math.random() * 30), 0, 0);
      const { data: existing } = await supabase
        .from("attendance_events")
        .select("id")
        .eq("staff_id", staffId)
        .eq("event_type", "check_in")
        .gte("occurred_at", `${day.toISOString().slice(0, 10)}T00:00:00Z`)
        .lt("occurred_at", `${day.toISOString().slice(0, 10)}T23:59:59Z`)
        .maybeSingle();
      if (existing) continue;
      await supabase.from("attendance_events").insert([
        { staff_id: staffId, event_type: "check_in", occurred_at: checkIn.toISOString() },
        { staff_id: staffId, event_type: "check_out", occurred_at: checkOut.toISOString() },
      ]);
    }
  }
  console.log("Attendance events seeded.");

  console.log("Seeding leave requests...");
  const leaveRequestsPayload = [
    { staff_id: staffIds[3], leave_type: "casual", start_date: "2026-08-10", end_date: "2026-08-11", reason: "Family function", status: "pending" },
    { staff_id: staffIds[2], leave_type: "sick", start_date: "2026-07-28", end_date: "2026-07-29", reason: "Fever", status: "approved", reviewed_by: staffIds[1] },
    { staff_id: staffIds[3], leave_type: "paid", start_date: "2026-06-15", end_date: "2026-06-17", reason: "Personal travel", status: "rejected", reviewed_by: staffIds[2], review_note: "Peak filing season — please reschedule." },
  ];
  for (const lr of leaveRequestsPayload) {
    const { data: existing } = await supabase
      .from("leave_requests")
      .select("id")
      .eq("staff_id", lr.staff_id)
      .eq("start_date", lr.start_date)
      .maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("leave_requests").insert(lr);
    if (error) throw new Error(`leave_requests insert: ${error.message}`);
  }
  console.log("Leave requests seeded.");

  console.log("Seeding salary structures + payslips...");
  const salaryByStaff = {
    [staffIds[1]]: { basic: 60000, hra: 24000, special_allowance: 10000, bonus: 5000, incentives: 0 },
    [staffIds[2]]: { basic: 40000, hra: 16000, special_allowance: 6000, bonus: 2000, incentives: 0 },
    [staffIds[3]]: { basic: 25000, hra: 10000, special_allowance: 3000, bonus: 0, incentives: 1000 },
  };
  for (const [staffId, comp] of Object.entries(salaryByStaff)) {
    const { data: existingStructure } = await supabase.from("salary_structures").select("id").eq("staff_id", staffId).maybeSingle();
    if (!existingStructure) {
      const { error } = await supabase.from("salary_structures").insert({ staff_id: staffId, ...comp, effective_from: "2023-04-01", created_by: idByEmail["admin@legalefilings.com"] });
      if (error) throw new Error(`salary_structures insert: ${error.message}`);
    }

    const gross = comp.basic + comp.hra + comp.special_allowance + comp.bonus + comp.incentives;
    const pf = Math.round(comp.basic * 0.12);
    const esi = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
    const professionalTax = gross > 15000 ? 200 : 0;
    const net = gross - pf - esi - professionalTax;

    for (const [month, year] of [[6, 2026], [7, 2026]]) {
      const { data: existingPayslip } = await supabase.from("payslips").select("id").eq("staff_id", staffId).eq("month", month).eq("year", year).maybeSingle();
      if (existingPayslip) continue;
      const { error } = await supabase.from("payslips").insert({
        staff_id: staffId,
        month,
        year,
        basic: comp.basic,
        hra: comp.hra,
        special_allowance: comp.special_allowance,
        bonus: comp.bonus,
        incentives: comp.incentives,
        overtime: 0,
        pf_deduction: pf,
        esi_deduction: esi,
        professional_tax: professionalTax,
        tds: 0,
        gross_salary: gross,
        net_salary: net,
        generated_by: idByEmail["admin@legalefilings.com"],
      });
      if (error) throw new Error(`payslips insert: ${error.message}`);
    }
  }
  console.log("Salary structures + payslips seeded.");

  console.log("Seeding holidays...");
  const holidaysPayload = [
    { name: "Independence Day", date: "2026-08-15", type: "national" },
    { name: "Ganesh Chaturthi", date: "2026-09-14", type: "festival" },
    { name: "Gandhi Jayanti", date: "2026-10-02", type: "national" },
    { name: "Diwali", date: "2026-11-08", type: "festival" },
    { name: "Company Foundation Day", date: "2026-04-01", type: "company" },
  ];
  for (const h of holidaysPayload) {
    const { data: existing } = await supabase.from("holidays").select("id").eq("name", h.name).eq("date", h.date).maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("holidays").insert({ ...h, created_by: idByEmail["admin@legalefilings.com"] });
    if (error) throw new Error(`holidays insert: ${error.message}`);
  }
  console.log("Holidays seeded.");

  console.log("Seeding employee document records...");
  // Metadata rows only — file_path points at a placeholder object, not an
  // actual uploaded file, so this is for exercising the list/table view,
  // not the download flow.
  const documentsPayload = [
    { staff_id: staffIds[3], document_type: "Aadhaar", file_path: `${staffIds[3]}/demo-aadhaar.pdf`, file_name: "aadhaar-card.pdf" },
    { staff_id: staffIds[3], document_type: "PAN", file_path: `${staffIds[3]}/demo-pan.pdf`, file_name: "pan-card.pdf" },
    { staff_id: staffIds[2], document_type: "Resume", file_path: `${staffIds[2]}/demo-resume.pdf`, file_name: "resume.pdf" },
  ];
  for (const doc of documentsPayload) {
    const { data: existing } = await supabase.from("employee_documents").select("id").eq("staff_id", doc.staff_id).eq("file_name", doc.file_name).maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("employee_documents").insert({ ...doc, uploaded_by: doc.staff_id });
    if (error) throw new Error(`employee_documents insert: ${error.message}`);
  }
  console.log("Employee document records seeded.");

  console.log("Seeding generated-letters audit log...");
  const lettersPayload = [
    { template_slug: "offer-letter", staff_id: null, employee_name: "New Candidate — Priyanka Rao", generated_by: idByEmail["admin@legalefilings.com"] },
    { template_slug: "experience-letter", staff_id: staffIds[3], employee_name: "Rahul Rater", generated_by: idByEmail["admin@legalefilings.com"] },
  ];
  for (const letter of lettersPayload) {
    const { data: existing } = await supabase.from("generated_letters").select("id").eq("employee_name", letter.employee_name).eq("template_slug", letter.template_slug).maybeSingle();
    if (existing) continue;
    const { error } = await supabase.from("generated_letters").insert(letter);
    if (error) throw new Error(`generated_letters insert: ${error.message}`);
  }
  console.log("Generated-letters audit log seeded.");

  console.log("Seeding a pending account request...");
  const { data: existingRequest } = await supabase.from("account_requests").select("id").eq("email", "new.hire@legalefilings.com").maybeSingle();
  if (!existingRequest) {
    const { error } = await supabase.from("account_requests").insert({
      full_name: "Priyanka Rao",
      email: "new.hire@legalefilings.com",
      phone: "+91 98000 12345",
      requested_account_type: "staff",
      requested_staff_level: "rater",
      message: "Referred by Leena — starting on the compliance team next week.",
      status: "pending",
    });
    if (error) throw new Error(`account_requests insert: ${error.message}`);
  }
  console.log("Account request seeded.");

  console.log("\nDone. Demo login credentials (password for all: Demo@12345):");
  for (const acc of DEMO_ACCOUNTS) console.log(`  ${acc.email}  (${acc.account_type}${acc.staff_level ? "/" + acc.staff_level : ""}${acc.customer_tier ? "/" + acc.customer_tier : ""})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
