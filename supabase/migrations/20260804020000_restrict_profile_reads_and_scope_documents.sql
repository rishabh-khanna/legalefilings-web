-- Close a real leak: "staff read all profiles" (20260730204000) let ANY
-- staff member read EVERY column of EVERY other profile row via a direct
-- browser-session query — including bank account/IFSC, Aadhaar, PAN,
-- UAN, ESIC and date of birth for every other employee and every
-- customer. RLS is row-level, not column-level, so scoping down to "own
-- reporting chain" wouldn't have been enough either — nobody but admin
-- has a legitimate reason to see a co-worker's bank/identity details.
-- Two legitimate browser-side lookups relied on this policy (customer
-- id+full_name pickers on the invoices and buy-for-customer pages) —
-- those now go through a new service-role-backed /api/customers route
-- instead, so nothing breaks. Self-read ("individuals read own
-- profile") and all admin access (via service-role API routes, which
-- bypass RLS entirely) are unaffected.
drop policy "staff read all profiles" on profiles;

-- Employee documents: hierarchy-based, not opt-in — a leader/group_leader
-- can see documents belonging to anyone in their reporting chain (their
-- own team), same rule as attendance/leave/orders/invoices elsewhere in
-- this schema. "staff read own documents" (20260803170000) already
-- covers the self case; admin access goes through the service-role API
-- routes and bypasses RLS entirely, so no admin-specific policy is
-- needed here either.
create policy "managers read team documents" on employee_documents for select using (
  is_in_reporting_chain(staff_id, auth.uid())
);
