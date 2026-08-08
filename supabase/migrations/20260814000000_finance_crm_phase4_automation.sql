-- ═══════════════════════════════════════════════════════════════════════
-- BUSINESS FINANCE CRM, PHASE 4: SMART AUTOMATION (minus OCR/AI insights
-- — explicitly held back, per the customer's own scoping call)
-- ═══════════════════════════════════════════════════════════════════════
-- Recurring expenses, the approval workflow, budgets, and the handful of
-- threshold-based alerts (low balance / large expense) from the spec's
-- Module 11. Bill reminders ride on the same recurring-template table
-- rather than a separate notifications system — "remind me before a
-- recurring bill is due" only ever means one thing: a template with an
-- upcoming next_run_date.

-- Approval workflow: an employee's entry can be held for review instead
-- of hitting the books immediately — off by default (every existing book
-- keeps behaving exactly as it does today until an owner/admin opts in).
alter table expense_business_profiles add column approval_required boolean not null default false;
alter table expense_business_profiles add column low_balance_threshold numeric(12, 2);
alter table expense_business_profiles add column large_expense_threshold numeric(12, 2);

-- expense_transactions.status already supports pending/approved/rejected
-- (Phase 1 built the enum with the approval workflow in mind, even
-- before this phase turned it on) — just needs somewhere to record who
-- reviewed it and why.
alter table expense_transactions add column reviewed_by uuid references profiles (id);
alter table expense_transactions add column review_note text;

create table expense_recurring_templates (
  id uuid primary key default gen_random_uuid(),
  book_owner_id uuid not null references profiles (id),
  organization_id uuid not null references organizations (id),
  transaction_type expense_transaction_type not null,
  category_id uuid references expense_categories (id),
  description text,
  amount numeric(12, 2) not null check (amount > 0),
  payment_mode expense_payment_mode not null,
  account_id uuid references expense_accounts (id),
  party_name text,
  -- 1-28 only — deliberately avoids the "the 30th/31st doesn't exist
  -- every month" problem rather than special-casing month-end.
  day_of_month smallint not null check (day_of_month between 1 and 28),
  next_run_date date not null,
  last_reminded_at date,
  is_active boolean not null default true,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expense_recurring_templates_book_owner_id_idx on expense_recurring_templates (book_owner_id);
create index expense_recurring_templates_next_run_date_idx on expense_recurring_templates (next_run_date) where is_active;
create trigger expense_recurring_templates_set_updated_at before update on expense_recurring_templates
  for each row execute function set_updated_at();
alter table expense_recurring_templates enable row level security;

create table expense_budgets (
  id uuid primary key default gen_random_uuid(),
  book_owner_id uuid not null references profiles (id),
  organization_id uuid not null references organizations (id),
  category_id uuid not null references expense_categories (id),
  -- A flat monthly cap that applies every month going forward, not a
  -- per-month row — "set monthly budgets by category" (Module 14) reads
  -- as one standing number per category, not something re-entered every
  -- month; changing it going forward is just updating this row.
  monthly_amount numeric(12, 2) not null check (monthly_amount > 0),
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_owner_id, category_id)
);
create trigger expense_budgets_set_updated_at before update on expense_budgets
  for each row execute function set_updated_at();
alter table expense_budgets enable row level security;

-- Service-role only (API-layer enforcement, same pattern as every other
-- table in this module) — RLS enabled with zero policies means
-- default-deny for any direct browser-session query.
