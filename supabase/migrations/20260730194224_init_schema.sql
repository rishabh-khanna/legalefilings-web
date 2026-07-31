-- Initial schema: role-based accounts, CRM leads, order/invoice workflow.
--
-- Design notes (why it's shaped this way):
-- - `leads` is deliberately separate from `profiles` (the real user/account
--   table) — an enquiry is not an account. A lead only gets linked to a
--   profile once/if it actually converts into a signed-up customer.
-- - Every status change (lead stage, order stage) is logged as its own row
--   in a `*_status_history` table instead of just overwriting a status
--   column. That's the CRM board's audit trail and the "workflow tracked by
--   status" the business asked for, and it costs nothing extra to add more
--   stages later since it's just more enum values + more history rows.
-- - A customer's "multiple active plans" is just multiple `orders` rows
--   for the same customer with a non-terminal status — no separate
--   subscriptions concept needed yet.

create extension if not exists "pgcrypto";

-- ── Roles ────────────────────────────────────────────────────────────────
create type account_type as enum ('customer', 'staff', 'admin');
create type customer_tier as enum ('free', 'paid');
create type staff_level as enum ('rater', 'leader', 'group_leader');

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  account_type account_type not null default 'customer',
  customer_tier customer_tier,
  staff_level staff_level,
  reports_to uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_tier_only_for_customers check (
    account_type = 'customer' or customer_tier is null
  ),
  constraint staff_level_only_for_staff check (
    account_type = 'staff' or staff_level is null
  )
);

-- ── CRM: leads (enquiry-form submissions) ──────────────────────────────────
create type lead_status as enum ('new', 'contacted', 'qualified', 'converted', 'lost');

create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  city text,
  state text,
  service text,
  plan text,
  plan_price text,
  message text,
  source text not null default 'website_consultation_form',
  status lead_status not null default 'new',
  assigned_to uuid references profiles (id),
  converted_to_profile_id uuid references profiles (id),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lead_status_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  old_status lead_status,
  new_status lead_status not null,
  changed_by uuid references profiles (id),
  note text,
  changed_at timestamptz not null default now()
);

create index leads_status_idx on leads (status);
create index leads_assigned_to_idx on leads (assigned_to);

-- ── Orders (a converted lead's actual engagement/plan) ─────────────────────
create type order_status as enum ('new', 'assigned', 'in_progress', 'under_review', 'completed', 'cancelled');

create table orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles (id),
  lead_id uuid references leads (id),
  service text not null,
  plan text not null,
  plan_price numeric(12, 2),
  status order_status not null default 'new',
  assigned_to uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  old_status order_status,
  new_status order_status not null,
  changed_by uuid references profiles (id),
  note text,
  changed_at timestamptz not null default now()
);

create index orders_customer_id_idx on orders (customer_id);
create index orders_status_idx on orders (status);
create index orders_assigned_to_idx on orders (assigned_to);

-- ── Invoices ────────────────────────────────────────────────────────────
create type invoice_status as enum ('draft', 'sent', 'paid', 'overdue', 'cancelled');

create table invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  order_id uuid not null references orders (id),
  customer_id uuid not null references profiles (id),
  subtotal numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  status invoice_status not null default 'draft',
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  description text not null,
  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null,
  amount numeric(12, 2) not null
);

create index invoices_customer_id_idx on invoices (customer_id);
create index invoices_order_id_idx on invoices (order_id);

-- ── updated_at auto-touch ──────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger leads_set_updated_at before update on leads
  for each row execute function set_updated_at();
create trigger orders_set_updated_at before update on orders
  for each row execute function set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────
-- Enabled from day one so nothing needs restructuring later; policies below
-- are intentionally permissive for now (any authenticated request via the
-- service-role key, which is what the server-side API routes use, bypasses
-- RLS entirely — these policies matter once real user-session-based access
-- from the client is added).
alter table profiles enable row level security;
alter table leads enable row level security;
alter table lead_status_history enable row level security;
alter table orders enable row level security;
alter table order_status_history enable row level security;
alter table invoices enable row level security;
alter table invoice_line_items enable row level security;

create policy "individuals read own profile" on profiles
  for select using (auth.uid() = id);
create policy "individuals update own profile" on profiles
  for update using (auth.uid() = id);

create policy "customers read own orders" on orders
  for select using (auth.uid() = customer_id);
create policy "customers read own invoices" on invoices
  for select using (auth.uid() = customer_id);
