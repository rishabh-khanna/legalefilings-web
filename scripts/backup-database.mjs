// Full database backup — dumps every table plus the Supabase Auth user
// list to one timestamped JSON file under backups/.
//
// Written as the safety net for the one-time purge in
// scripts/purge-all-data.mjs: that script deletes every row in every
// table and every auth user, which is otherwise completely
// unrecoverable. Run this first, always.
//
// Usage: node scripts/backup-database.mjs

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

process.loadEnvFile(new URL("../.env.local", import.meta.url).pathname);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

// Every table in the schema — kept in sync with supabase/migrations.
const TABLES = [
  "organizations", "profiles", "departments", "department_roles",
  "leads", "lead_status_history",
  "orders", "order_status_history", "order_documents",
  "invoices", "invoice_line_items", "invoice_payments", "invoice_events",
  "invoice_attachments", "invoice_reminders", "invoice_number_counters",
  "recurring_invoice_templates",
  "attendance_events", "attendance_corrections",
  "leave_types", "leave_requests", "leave_balances",
  "holidays", "payslips", "salary_structures",
  "employee_documents", "generated_letters",
  "account_requests", "org_access_requests",
  "company_settings", "company_gst_registrations", "product_service_master",
  "staff_tool_grants", "email_failures",
  "expense_business_profiles", "expense_accounts", "expense_categories",
  "expense_transactions", "expense_book_members", "expense_budgets",
  "expense_recurring_templates", "expense_audit_log", "expense_documents",
];

async function fetchAll(table) {
  // Paged — PostgREST caps a single response at 1000 rows by default, so
  // a straight select() would silently truncate a large table and back
  // up an incomplete snapshot, which is worse than no backup at all.
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + PAGE - 1);
    if (error) return { error: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return { rows };
}

async function fetchAuthUsers() {
  const users = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    if (!data?.users?.length) break;
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email, phone: u.phone, created_at: u.created_at, user_metadata: u.user_metadata })));
    if (data.users.length < 200) break;
  }
  return users;
}

async function main() {
  const dump = { takenAt: new Date().toISOString(), tables: {}, authUsers: [] };
  let total = 0;

  for (const table of TABLES) {
    const { rows, error } = await fetchAll(table);
    if (error) {
      console.log(`  ! ${table}: ${error}`);
      dump.tables[table] = { error };
      continue;
    }
    dump.tables[table] = rows;
    total += rows.length;
    if (rows.length) console.log(`  ${String(rows.length).padStart(6)}  ${table}`);
  }

  dump.authUsers = await fetchAuthUsers();
  console.log(`  ${String(dump.authUsers.length).padStart(6)}  (auth users)`);

  const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "backups");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(path, JSON.stringify(dump, null, 2));

  console.log(`\nBacked up ${total} rows + ${dump.authUsers.length} auth users`);
  console.log(`-> ${path}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
