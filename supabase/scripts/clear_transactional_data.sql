-- ═══════════════════════════════════════════════════════════════════════
-- CLEAR TEST/TRANSACTIONAL DATA — run manually in the Supabase SQL editor
-- ═══════════════════════════════════════════════════════════════════════
-- This is NOT a migration (not in supabase/migrations/) — it's a one-off
-- maintenance script you run yourself, once, when you're ready to wipe
-- test transactions before real customers start using the platform.
--
-- KEPT (master/reference/config data — NOT touched by this script):
--   organizations, company_settings, company_gst_registrations,
--   product_service_master, holidays, departments, department_roles,
--   profiles (see the STEP 2 note below — this is deliberately separate
--   and NOT run automatically), expense_categories (per-customer's own
--   category list — usually worth keeping as a starting point)
--
-- CLEARED (transactional/test data — everything a test order, test
-- invoice, test attendance punch, etc. would have created):
--   leads, lead_status_history, orders, order_status_history,
--   order_documents, invoices, invoice_line_items, invoice_events,
--   invoice_payments, invoice_attachments, recurring_invoice_templates,
--   attendance_events, attendance_corrections, leave_requests,
--   payslips, salary_structures, generated_letters, employee_documents,
--   account_requests, org_access_requests, expense_transactions,
--   expense_accounts, expense_budgets, expense_business_profiles,
--   expense_book_members, expense_audit_log, expense_documents,
--   expense_recurring_templates
--
-- ── STEP 1: LOOK BEFORE YOU DELETE ──────────────────────────────────────
-- Run this first and actually read the counts. If any number looks like
-- real data you meant to keep, stop and tell me before running STEP 3.
select 'leads' as table_name, count(*) from leads
union all select 'orders', count(*) from orders
union all select 'invoices', count(*) from invoices
union all select 'attendance_events', count(*) from attendance_events
union all select 'leave_requests', count(*) from leave_requests
union all select 'payslips', count(*) from payslips
union all select 'expense_transactions', count(*) from expense_transactions
union all select 'account_requests', count(*) from account_requests
union all select 'org_access_requests', count(*) from org_access_requests;

-- ── STEP 2: PROFILES — NOT included below on purpose ────────────────────
-- Test customer/staff accounts you created while building this live in
-- `profiles` (and cascade-delete their auth.users row). This script does
-- NOT touch profiles, because I can't tell your real admin account and
-- any real early customers apart from throwaway test accounts — deleting
-- the wrong one is much harder to undo than re-running this script would
-- be. If you want specific test accounts gone, delete them by email
-- through Supabase Auth (Dashboard → Authentication → Users) — the
-- profile row cascades automatically. List who's currently in there:
select p.id, u.email, p.full_name, p.account_type, p.staff_level, p.organization_id, p.created_at
from profiles p
join auth.users u on u.id = p.id
order by p.created_at;

-- ── STEP 3: THE ACTUAL DELETE — wrapped in a transaction ────────────────
-- Reversible until COMMIT. If STEP 1's counts looked wrong, run
-- ROLLBACK instead of COMMIT and nothing changes.
begin;

delete from invoice_payments;
delete from invoice_events;
delete from invoice_line_items;
delete from invoice_attachments;
delete from recurring_invoice_templates;
delete from invoices;

delete from order_status_history;
delete from order_documents;
delete from orders;

delete from lead_status_history;
delete from leads;

delete from attendance_corrections;
delete from attendance_events;
delete from leave_requests;
delete from payslips;
delete from salary_structures;
delete from generated_letters;
delete from employee_documents;

delete from account_requests;
delete from org_access_requests;

delete from expense_audit_log;
delete from expense_documents;
delete from expense_transactions;
delete from expense_recurring_templates;
delete from expense_budgets;
delete from expense_book_members;
delete from expense_accounts;
delete from expense_business_profiles;

-- Uncomment only if you also want every count that just ran above
-- reflected as 0 and you're 100% sure you reviewed STEP 1's output:
-- commit;

-- Otherwise, leave the transaction open and decide by hand:
--   commit;    -- makes the deletes permanent
--   rollback;  -- undoes everything above, nothing is lost
