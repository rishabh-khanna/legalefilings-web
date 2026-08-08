-- ═══════════════════════════════════════════════════════════════════════
-- BUSINESS FINANCE CRM, PHASE 3: MULTI-USER ACCESS + AUDIT TRAIL
-- ═══════════════════════════════════════════════════════════════════════
-- Module 12 (Owner/Admin/Accountant/Employee/Viewer) + Module 15 (every
-- action recorded). A customer's books are still owned by exactly one
-- customer (book_owner_id), but now other real accounts on the platform
-- can be granted role-based access to them — an accountant might work
-- across several different customers' books, so access is a many-to-many
-- membership table, not a single owner column.
--
-- The owner themselves gets a real 'owner' row in this same table (auto-
-- inserted the moment their setup completes) rather than being a special
-- case handled differently from every other member — every access check
-- everywhere in the app becomes one lookup against expense_book_members,
-- regardless of whether the caller is the original owner or someone they
-- invited.

create type expense_book_role as enum ('owner', 'admin', 'accountant', 'employee', 'viewer');

create table expense_book_members (
  id uuid primary key default gen_random_uuid(),
  book_owner_id uuid not null references profiles (id),
  member_id uuid not null references profiles (id),
  organization_id uuid not null references organizations (id),
  role expense_book_role not null,
  invited_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  unique (book_owner_id, member_id)
);
create index expense_book_members_book_owner_id_idx on expense_book_members (book_owner_id);
create index expense_book_members_member_id_idx on expense_book_members (member_id);
alter table expense_book_members enable row level security;

-- Backfill: every existing book gets its owner's membership row, so
-- access resolution can rely on this table alone from day one, including
-- for businesses that completed setup before this migration ran.
insert into expense_book_members (book_owner_id, member_id, organization_id, role)
select customer_id, customer_id, organization_id, 'owner'
from expense_business_profiles
on conflict (book_owner_id, member_id) do nothing;

create table expense_audit_log (
  id uuid primary key default gen_random_uuid(),
  book_owner_id uuid not null references profiles (id),
  organization_id uuid not null references organizations (id),
  actor_id uuid not null references profiles (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail text,
  created_at timestamptz not null default now()
);
create index expense_audit_log_book_owner_id_idx on expense_audit_log (book_owner_id);
alter table expense_audit_log enable row level security;

-- Service-role only (API-layer enforcement, same pattern as every other
-- table in this module) — RLS enabled with zero policies means
-- default-deny for any direct browser-session query.
