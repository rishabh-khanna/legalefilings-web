-- 1) Document visibility: an employee can choose, at upload time, whether
-- a document stays private to themself (+ admin, always) or is also
-- shared with their manager (reporting chain). Default stays private —
-- sharing is opt-in, never automatic.
create type document_visibility as enum ('private', 'manager');

alter table employee_documents
  add column visibility document_visibility not null default 'private';

create policy "managers read shared team documents" on employee_documents
  for select using (
    visibility = 'manager' and is_in_reporting_chain(staff_id, auth.uid())
  );

-- 2) Close a real leak: "staff read all profiles" (20260730204000) let
-- ANY staff member read EVERY column of EVERY other profile row via a
-- direct browser-session query — including bank account/IFSC, Aadhaar,
-- PAN, UAN, ESIC and date of birth for every other employee and every
-- customer. RLS is row-level, not column-level, so scoping down to "own
-- reporting chain" wouldn't have been enough either — a rater has no
-- legitimate reason to see a co-worker's bank details at all, and even a
-- manager only needs names, not identity/bank numbers, for the pickers
-- that used this policy. Two legitimate browser-side lookups relied on
-- it (customer id+full_name pickers on the invoices and buy-for-customer
-- pages) — those now go through a new service-role-backed /api/customers
-- route instead, so nothing breaks. Self-read ("individuals read own
-- profile") and all admin access (via service-role API routes, which
-- bypass RLS entirely) are unaffected.
drop policy "staff read all profiles" on profiles;
