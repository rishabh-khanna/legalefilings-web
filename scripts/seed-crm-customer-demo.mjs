// One-off seed script — creates a brand-new organization with a single
// PAID CUSTOMER account that has been delegated real CRM tool access
// (Leads CRM, Invoice CRM, Team Attendance, Team Leave Requests, plus the
// already-delegable Employees + Payroll) via staff_tool_grants, WITHOUT
// ever promoting account_type off "customer". This is the intended
// replacement for the older "promote a customer to admin of a new org"
// CRM-access-request flow — see src/lib/tool-grants.ts DELEGABLE_TOOLS
// for why those four tool keys exist.
//
// Also seeds a couple of org staff + a lead + an attendance day + a
// pending leave request, so the demo customer's granted pages show real
// data instead of empty states, and a completed order + invoice so the
// account genuinely looks like a paying customer, not just a shell.
//
// Safe to re-run: upserts by email/known IDs where practical.
//
// Usage: node scripts/seed-crm-customer-demo.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY in the env
// (already in .env.local).

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
const ORG_SLUG = "meridian-consulting";
const ORG_NAME = "Meridian Consulting Pvt Ltd";

const CUSTOMER_EMAIL = "crm.customer@legalefilings.com";
const ADMIN_EMAIL = "meridian.admin@legalefilings.com";
const STAFF_EMAIL = "meridian.staff@legalefilings.com";

async function upsertAuthUser(email, password) {
  const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = existing?.users?.find((u) => u.email === email);
  if (found) return found;
  const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  return data.user;
}

async function ensureOrganization() {
  const { data: existing } = await supabase.from("organizations").select("id").eq("slug", ORG_SLUG).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name: ORG_NAME, slug: ORG_SLUG, plan_tier: "business" })
    .select("id")
    .single();
  if (error) throw new Error(`organizations insert: ${error.message}`);
  return data.id;
}

async function ensureCompanySettings(organizationId) {
  const { data: existing } = await supabase.from("company_settings").select("organization_id").eq("organization_id", organizationId).maybeSingle();
  if (existing) return;
  const { error } = await supabase.from("company_settings").insert({
    organization_id: organizationId,
    address: "Meridian Consulting, Bandra Kurla Complex",
    gst_number: "27AAAAM0000M1Z8",
    pan_number: "AAAAM0000M",
    financial_year_start_month: 4,
    state: "Maharashtra",
    state_code: "27",
    bank_name: "ICICI Bank",
    bank_account_number: "60200999888777",
    bank_ifsc: "ICIC0005678",
    bank_branch: "BKC, Mumbai",
    upi_id: "meridianconsulting@icici",
    default_invoice_notes: "Thank you for your business. GST once charged is non-refundable.",
    invoice_number_prefix: "MC-INV",
  });
  if (error) throw new Error(`company_settings insert: ${error.message}`);
}

async function main() {
  console.log("Ensuring Meridian Consulting organization + company settings...");
  const orgId = await ensureOrganization();
  await ensureCompanySettings(orgId);
  console.log(`  organization ready: ${orgId}`);

  console.log("Seeding accounts...");
  const adminUser = await upsertAuthUser(ADMIN_EMAIL, DEMO_PASSWORD);
  const staffUser = await upsertAuthUser(STAFF_EMAIL, DEMO_PASSWORD);
  const customerUser = await upsertAuthUser(CUSTOMER_EMAIL, DEMO_PASSWORD);

  // The org's own admin — needed as a real FK target (staff_tool_grants
  // .granted_by, leads.assigned_to's manager, leave approvals happening
  // before the customer's own grant existed) but deliberately NOT surfaced
  // in DemoLoginCredentials — the whole point of this org is the customer
  // account below, not another admin login to demo.
  {
    const { error } = await supabase.from("profiles").upsert({
      id: adminUser.id,
      full_name: "Meridian Admin",
      account_type: "admin",
      organization_id: orgId,
      employee_id: "MC-0001",
      crm_status: "active",
    });
    if (error) throw new Error(`admin profile upsert: ${error.message}`);
  }

  {
    const { error } = await supabase.from("profiles").upsert({
      id: staffUser.id,
      full_name: "Meridian Staff",
      account_type: "staff",
      staff_level: "rater",
      organization_id: orgId,
      reports_to: adminUser.id,
      employee_id: "MC-0002",
      department: "Sales",
      designation: "Sales Associate",
      date_of_joining: "2025-06-01",
      crm_status: "active",
    });
    if (error) throw new Error(`staff profile upsert: ${error.message}`);
  }

  // The paid customer account this whole script exists for — account_type
  // stays "customer" for good, full stop. Every capability below comes
  // from staff_tool_grants, never from a role promotion.
  {
    const { error } = await supabase.from("profiles").upsert({
      id: customerUser.id,
      full_name: "Devika Rao",
      account_type: "customer",
      customer_tier: "paid",
      organization_id: orgId,
      company: "Rao Retail Ventures",
      city: "Mumbai",
      state: "Maharashtra",
      state_code: "27",
      phone: "+91 98200 11223",
      gstin: "27AAACR1234M1Z5",
      crm_status: "active",
    });
    if (error) throw new Error(`customer profile upsert: ${error.message}`);
  }
  console.log("Accounts ready.");

  console.log("Seeding a completed order + invoice for the paid customer...");
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("customer_id", customerUser.id)
    .eq("service", "CRM Workspace — Annual Plan")
    .maybeSingle();
  let orderId = existingOrder?.id;
  if (!orderId) {
    const { data, error } = await supabase
      .from("orders")
      .insert({
        organization_id: orgId,
        customer_id: customerUser.id,
        service: "CRM Workspace — Annual Plan",
        plan: "Business",
        plan_price: 49999,
        status: "completed",
        assigned_to: adminUser.id,
      })
      .select()
      .single();
    if (error) throw new Error(`order insert: ${error.message}`);
    orderId = data.id;
  }

  const { data: existingInvoice } = await supabase.from("invoices").select("id").eq("order_id", orderId).maybeSingle();
  if (!existingInvoice) {
    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        organization_id: orgId,
        order_id: orderId,
        customer_id: customerUser.id,
        invoice_number: "MC-INV-1001",
        subtotal: 49999,
        tax_amount: 0,
        total: 49999,
        status: "paid",
      })
      .select()
      .single();
    if (error) throw new Error(`invoice insert: ${error.message}`);
    await supabase.from("invoice_line_items").insert({
      invoice_id: invoice.id,
      description: "CRM Workspace — Business Annual Plan",
      quantity: 1,
      unit_price: 49999,
      amount: 49999,
    });
  }
  console.log("Order + invoice seeded — this customer is a genuine paid account.");

  console.log("Granting full CRM tool access to the customer (account_type stays 'customer')...");
  const toolKeys = ["employees", "payroll", "leads_crm", "invoice_crm", "team_attendance", "team_leave"];
  for (const toolKey of toolKeys) {
    const { error } = await supabase
      .from("staff_tool_grants")
      .upsert(
        { organization_id: orgId, staff_id: customerUser.id, tool_key: toolKey, granted_by: adminUser.id, expires_at: null },
        { onConflict: "staff_id,tool_key" }
      );
    if (error) throw new Error(`tool grant (${toolKey}): ${error.message}`);
  }
  console.log(`Granted: ${toolKeys.join(", ")}`);

  console.log("Seeding a lead, attendance day, and pending leave request so the granted pages have real data...");
  const { data: existingLead } = await supabase.from("leads").select("id").eq("email", "prospect@newventures.in").maybeSingle();
  if (!existingLead) {
    const { error } = await supabase.from("leads").insert({
      organization_id: orgId,
      name: "Karan Mehta",
      company: "New Ventures Pvt Ltd",
      email: "prospect@newventures.in",
      phone: "+91 90000 55667",
      city: "Mumbai",
      state: "Maharashtra",
      service: "GST Registration",
      status: "new",
      assigned_to: staffUser.id,
      source: "website_consultation_form",
    });
    if (error) throw new Error(`lead insert: ${error.message}`);
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dayKey = yesterday.toISOString().slice(0, 10);
  const { data: existingAttendance } = await supabase
    .from("attendance_events")
    .select("id")
    .eq("staff_id", staffUser.id)
    .eq("event_type", "check_in")
    .gte("occurred_at", `${dayKey}T00:00:00Z`)
    .lt("occurred_at", `${dayKey}T23:59:59Z`)
    .maybeSingle();
  if (!existingAttendance) {
    const checkIn = new Date(yesterday);
    checkIn.setHours(9, 45, 0, 0);
    const checkOut = new Date(yesterday);
    checkOut.setHours(18, 15, 0, 0);
    await supabase.from("attendance_events").insert([
      { staff_id: staffUser.id, organization_id: orgId, event_type: "check_in", occurred_at: checkIn.toISOString() },
      { staff_id: staffUser.id, organization_id: orgId, event_type: "check_out", occurred_at: checkOut.toISOString() },
    ]);
  }

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const startKey = nextWeek.toISOString().slice(0, 10);
  const { data: existingLeave } = await supabase
    .from("leave_requests")
    .select("id")
    .eq("staff_id", staffUser.id)
    .eq("start_date", startKey)
    .maybeSingle();
  if (!existingLeave) {
    const { error } = await supabase.from("leave_requests").insert({
      organization_id: orgId,
      staff_id: staffUser.id,
      leave_type: "unpaid",
      start_date: startKey,
      end_date: startKey,
      reason: "Personal work",
      status: "pending",
      day_fraction: 1,
    });
    if (error) throw new Error(`leave_requests insert: ${error.message}`);
  }
  console.log("Demo data seeded.");

  console.log("\nDone. Paid customer with full CRM tool access (password: Demo@12345):");
  console.log(`  ${CUSTOMER_EMAIL}  (customer/paid — grants: ${toolKeys.join(", ")})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
