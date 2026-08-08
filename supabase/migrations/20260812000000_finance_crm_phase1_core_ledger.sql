-- ═══════════════════════════════════════════════════════════════════════
-- BUSINESS FINANCE CRM, PHASE 1: CORE LEDGER
-- ═══════════════════════════════════════════════════════════════════════
-- A customer's own bookkeeping — bank accounts, cash book, expense/income
-- entries — kept as its own module, scoped to the customer who owns it
-- (customer_id), not shared across a whole tenant org the way leads/
-- invoices are. organization_id is still carried on every table (same
-- convention as orders/invoices) so a tenant's data stays isolated from
-- Legal Efilings' own and from every other tenant, but within an org,
-- these books are private to the one customer who owns them — Phase 1
-- has no staff/accountant access at all (that's Module 12, a later
-- phase, deliberately deferred).

create type expense_business_type as enum ('proprietorship', 'partnership', 'llp', 'private_limited', 'ngo', 'trust', 'individual');
create type expense_payment_mode as enum ('bank', 'cash', 'upi', 'cheque', 'card');
create type expense_transaction_type as enum ('expense', 'income');
create type expense_transaction_status as enum ('pending', 'approved', 'rejected');

-- ── Module 2: first-time setup ──────────────────────────────────────────
create table expense_business_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references profiles (id),
  organization_id uuid not null references organizations (id),
  business_type expense_business_type not null,
  financial_year text not null,
  currency text not null default 'INR',
  cash_opening_balance numeric(12, 2) not null default 0,
  -- Kept as a running balance (updated by the app layer on every cash
  -- transaction — see expense_transactions below), not recomputed from
  -- scratch on every read — same "automatic balance" approach as the
  -- bank accounts, and it's what Module 6 (Cash Book) shows directly.
  cash_balance numeric(12, 2) not null default 0,
  setup_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger expense_business_profiles_set_updated_at before update on expense_business_profiles
  for each row execute function set_updated_at();
alter table expense_business_profiles enable row level security;

-- ── Module 5: bank accounts ──────────────────────────────────────────────
create table expense_accounts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles (id),
  organization_id uuid not null references organizations (id),
  bank_name text not null,
  account_name text not null,
  opening_balance numeric(12, 2) not null default 0,
  opening_date date not null,
  -- Same "automatic balance" approach as cash_balance above.
  current_balance numeric(12, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expense_accounts_customer_id_idx on expense_accounts (customer_id);
create trigger expense_accounts_set_updated_at before update on expense_accounts
  for each row execute function set_updated_at();
alter table expense_accounts enable row level security;

-- ── Module 3 categories: system defaults (customer_id null, shared by
-- everyone) plus each customer's own custom ones ──────────────────────
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references profiles (id),
  organization_id uuid references organizations (id),
  name text not null,
  transaction_type expense_transaction_type not null default 'expense',
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);
create index expense_categories_customer_id_idx on expense_categories (customer_id);
alter table expense_categories enable row level security;

insert into expense_categories (name, transaction_type, is_system) values
  ('Office Expenses', 'expense', true),
  ('Printing Expenses', 'expense', true),
  ('Advertisement', 'expense', true),
  ('Salary', 'expense', true),
  ('Rent', 'expense', true),
  ('Electricity', 'expense', true),
  ('Internet', 'expense', true),
  ('Telephone', 'expense', true),
  ('Fuel', 'expense', true),
  ('Travelling', 'expense', true),
  ('Repair & Maintenance', 'expense', true),
  ('Professional Fees', 'expense', true),
  ('Bank Charges', 'expense', true),
  ('Insurance', 'expense', true),
  ('Stationery', 'expense', true),
  ('Courier', 'expense', true),
  ('Food', 'expense', true),
  ('Tea & Snacks', 'expense', true),
  ('Software Subscription', 'expense', true),
  ('Hosting', 'expense', true),
  ('Domain', 'expense', true),
  ('Consultancy', 'expense', true),
  ('Marketing', 'expense', true),
  ('Facebook Ads', 'expense', true),
  ('Google Ads', 'expense', true),
  ('Commission', 'expense', true),
  ('Interest', 'expense', true),
  ('Donation', 'expense', true),
  ('Miscellaneous', 'expense', true),
  ('Sales', 'income', true),
  ('Service Income', 'income', true),
  ('Consulting Income', 'income', true),
  ('Interest Income', 'income', true),
  ('Commission Income', 'income', true),
  ('Other Income', 'income', true);

-- ── Modules 3 & 4: expense and income entries share one table (the
-- fields overlap far more than they differ — amount, date, category,
-- payment mode, party, document number — and a unified table is what
-- makes a combined "Recent Transactions" feed and running balances
-- possible without reading two tables and merging in the app layer) ───
create table expense_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles (id),
  organization_id uuid not null references organizations (id),
  transaction_type expense_transaction_type not null,
  transaction_date date not null,
  category_id uuid references expense_categories (id),
  description text,
  amount numeric(12, 2) not null check (amount > 0),
  payment_mode expense_payment_mode not null,
  -- null when payment_mode = 'cash' (affects cash_balance instead).
  account_id uuid references expense_accounts (id),
  reference_number text,
  -- "Vendor Name" on an expense, "Customer" on income — one generic
  -- column, labeled contextually in the UI rather than two near-duplicate
  -- columns that would always be mutually exclusive anyway.
  party_name text,
  gstin text,
  -- "Bill Number" on an expense, "Invoice Number" on income — same
  -- reasoning as party_name.
  document_number text,
  gst_applicable boolean not null default false,
  taxable_value numeric(12, 2),
  cgst numeric(12, 2),
  sgst numeric(12, 2),
  igst numeric(12, 2),
  notes text,
  -- Defaults to 'approved' so Phase 1 (no approval workflow yet, no
  -- multi-user access yet) just works — only meaningful once Module 12/
  -- the approval workflow phase turns it on for a given business.
  status expense_transaction_status not null default 'approved',
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expense_transactions_customer_id_idx on expense_transactions (customer_id);
create index expense_transactions_date_idx on expense_transactions (transaction_date);
create index expense_transactions_account_id_idx on expense_transactions (account_id);
create trigger expense_transactions_set_updated_at before update on expense_transactions
  for each row execute function set_updated_at();
alter table expense_transactions enable row level security;

-- ── Module 7: attachments ────────────────────────────────────────────────
create table expense_documents (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references expense_transactions (id) on delete cascade,
  organization_id uuid not null references organizations (id),
  file_name text not null,
  file_path text not null,
  file_size bigint,
  uploaded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index expense_documents_transaction_id_idx on expense_documents (transaction_id);
alter table expense_documents enable row level security;

-- Service-role only (API-layer enforcement, same pattern as every other
-- org-scoped table in this app) — RLS enabled with zero policies means
-- default-deny for any direct browser-session query.

-- ═══════════════════════════════════════════════════════════════════════
-- MANUAL STEP — create the storage bucket yourself (same as
-- "employee-documents", "invoice-attachments", "order-documents" before
-- it — buckets aren't created via SQL migrations in this project):
--
--   Supabase Dashboard → Storage → New bucket → name: "expense-documents",
--   Public: OFF (private — downloads are always served through a signed
--   URL from the API, never a public path).
-- ═══════════════════════════════════════════════════════════════════════
