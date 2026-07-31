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

  console.log("\nDone. Demo login credentials (password for all: Demo@12345):");
  for (const acc of DEMO_ACCOUNTS) console.log(`  ${acc.email}  (${acc.account_type}${acc.staff_level ? "/" + acc.staff_level : ""}${acc.customer_tier ? "/" + acc.customer_tier : ""})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
