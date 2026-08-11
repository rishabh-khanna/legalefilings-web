// DESTRUCTIVE — deletes every row in every table and every Supabase Auth
// user, leaving a completely empty database. Written for the one-time
// reset before scripts/seed-production-demo.mjs rebuilt the environment
// with genuine data, after ~190 of 204 profiles turned out to be
// timestamped junk accumulated by repeated e2e runs.
//
// ALWAYS run scripts/backup-database.mjs first — nothing here is
// recoverable otherwise.
//
// Usage: node scripts/purge-all-data.mjs --yes

import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(new URL("../.env.local", import.meta.url).pathname);

if (!process.argv.includes("--yes")) {
  console.error("Refusing to run without --yes. This deletes EVERYTHING.");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

// Children before parents. Several of these would cascade anyway, but
// deleting explicitly in dependency order means a missing/renamed
// cascade can't leave an orphan row that then blocks the parent delete
// with a foreign-key error halfway through.
const DELETE_ORDER = [
  // Business Finance (its own subtree, references profiles + organizations)
  "expense_audit_log", "expense_documents", "expense_budgets",
  "expense_recurring_templates", "expense_transactions", "expense_book_members",
  "expense_accounts", "expense_categories", "expense_business_profiles",
  // Invoicing — recurring_invoice_templates before invoices:
  // last_generated_invoice_id points AT an invoice, so the templates
  // have to go first even though they read like the higher-level thing.
  "invoice_attachments", "invoice_events", "invoice_payments",
  "invoice_line_items", "invoice_reminders",
  "recurring_invoice_templates", "invoices", "invoice_number_counters",
  // Requests / access — before orders, because
  // org_access_requests.qualifying_order_id points at the order that
  // made a customer eligible for their own CRM workspace.
  "account_requests", "org_access_requests", "staff_tool_grants",
  // Orders
  "order_documents", "order_status_history", "orders",
  // Leads
  "lead_status_history", "leads",
  // HR
  "attendance_corrections", "attendance_events",
  "leave_balances", "leave_requests", "leave_types",
  "payslips", "salary_structures",
  "employee_documents", "generated_letters", "holidays",
  // Org config
  "company_gst_registrations", "company_settings", "product_service_master",
  "email_failures",
];

// Two tables are keyed by organization_id rather than a surrogate id —
// invoice_number_counters on (organization_id, series), and
// company_settings one-row-per-org — so the usual id-based guard below
// can't apply to either.
const GUARD_COLUMN = {
  invoice_number_counters: "organization_id",
  company_settings: "organization_id",
};

async function deleteAll(table) {
  // .neq on a never-null uuid column is how PostgREST expresses
  // "unfiltered delete" — it refuses a DELETE with no WHERE clause at
  // all, as a guard against exactly this kind of mistake.
  const column = GUARD_COLUMN[table] ?? "id";
  const { error } = await supabase.from(table).delete().neq(column, "00000000-0000-0000-0000-000000000000");
  if (error) throw new Error(`${table}: ${error.message}`);
  const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
  console.log(`  cleared ${table}${count ? ` (${count} LEFT!)` : ""}`);
}

async function main() {
  for (const table of DELETE_ORDER) await deleteAll(table);

  // profiles points back at three things that are themselves about to
  // be deleted — itself (reports_to), department_roles, and departments.
  // All three have to be nulled first, or the deletes below fail against
  // profiles' own foreign keys.
  console.log("  nulling profile self-references…");
  const { error: nullErr } = await supabase
    .from("profiles")
    .update({ reports_to: null, department_role_id: null, department_id: null })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (nullErr) throw new Error(`profiles null refs: ${nullErr.message}`);

  await deleteAll("department_roles");
  await deleteAll("departments");

  // organizations.created_by points at a profile, so every org has to
  // let go of its creator before the profiles themselves can be
  // deleted — the reverse of the intuitive parent/child order here.
  console.log("  nulling organizations.created_by…");
  const { error: orgNullErr } = await supabase
    .from("organizations")
    .update({ created_by: null })
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (orgNullErr) throw new Error(`organizations null created_by: ${orgNullErr.message}`);

  await deleteAll("profiles");
  await deleteAll("organizations");

  // Auth users last — a profiles row FKs to auth.users(id), so these
  // can only go once every profile is already gone.
  console.log("  deleting auth users…");
  let deleted = 0;
  for (;;) {
    const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (!data?.users?.length) break;
    for (const user of data.users) {
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) throw new Error(`deleteUser(${user.email}): ${error.message}`);
      deleted++;
    }
  }
  console.log(`  deleted ${deleted} auth users`);

  console.log("\nDatabase is empty.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
