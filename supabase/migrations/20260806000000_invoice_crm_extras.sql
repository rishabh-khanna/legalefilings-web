-- Multiple GST registrations — a company operating from more than one
-- state (or under more than one GSTIN) needs to pick which registration
-- an invoice is issued under, since that's what decides intra vs
-- inter-state tax for that specific invoice. company_settings stays the
-- default/fallback; this table is the optional additional set.
create table company_gst_registrations (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  gst_number text not null,
  pan_number text,
  address text,
  state text,
  state_code text,
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table company_gst_registrations enable row level security;
create policy "staff read gst registrations" on company_gst_registrations for select using (is_staff_or_admin());

alter table invoices add column gst_registration_id uuid references company_gst_registrations (id);
alter table invoices add column pdf_template text not null default 'classic' check (pdf_template in ('classic', 'modern'));

-- Recurring invoices — a saved template (customer + items + charges +
-- terms, same shape as a one-off invoice) plus a frequency and next-run
-- date; a cron endpoint finds due templates and generates a real Billed
-- Invoice from each one, then advances next_run_date. Storing the full
-- line-item payload as jsonb rather than a parallel set of tables since
-- it's write-once/read-by-the-generator-only, not something queried or
-- joined against elsewhere.
create type recurring_frequency as enum ('weekly', 'monthly', 'quarterly', 'yearly');

create table recurring_invoice_templates (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles (id),
  invoice_type invoice_type not null default 'gst',
  payload jsonb not null,
  frequency recurring_frequency not null default 'monthly',
  next_run_date date not null,
  active boolean not null default true,
  created_by uuid references profiles (id),
  last_generated_invoice_id uuid references invoices (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger recurring_invoice_templates_set_updated_at before update on recurring_invoice_templates
  for each row execute function set_updated_at();
create index recurring_invoice_templates_next_run_idx on recurring_invoice_templates (next_run_date) where active;

alter table recurring_invoice_templates enable row level security;
create policy "staff read scoped recurring templates" on recurring_invoice_templates for select using (
  is_staff_or_admin() and (
    exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
    or created_by is null
    or is_in_reporting_chain(created_by, auth.uid())
  )
);
