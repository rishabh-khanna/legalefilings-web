-- HRMS additions from the "Website Changes" spec: employee master fields,
-- payroll/payslips, holiday calendar, employee documents, company
-- settings (singleton), and an audit log for generated HR letters.
-- Follows the same pattern as leads/invoices: RLS enabled, access mostly
-- through API routes using the service-role key, with a few narrow
-- self-read policies where a person should see their own record directly.

-- ── Employee master fields (extends profiles rather than a parallel
-- "employees" table, matching how this app already treats profiles as
-- the one shared people table for every account type) ──────────────────
alter table profiles add column employee_id text unique;
alter table profiles add column aadhaar_number text;
alter table profiles add column pan_number text;
alter table profiles add column department text;
alter table profiles add column designation text;
alter table profiles add column date_of_joining date;
alter table profiles add column bank_account_number text;
alter table profiles add column bank_ifsc text;
alter table profiles add column bank_name text;
alter table profiles add column uan_number text;
alter table profiles add column esic_number text;
alter table profiles add column emergency_contact_name text;
alter table profiles add column emergency_contact_phone text;

-- ── Payroll ──────────────────────────────────────────────────────────
create table salary_structures (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id),
  basic numeric(12, 2) not null default 0,
  hra numeric(12, 2) not null default 0,
  special_allowance numeric(12, 2) not null default 0,
  bonus numeric(12, 2) not null default 0,
  incentives numeric(12, 2) not null default 0,
  effective_from date not null default current_date,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index salary_structures_staff_id_idx on salary_structures (staff_id);

create table payslips (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id),
  month smallint not null check (month between 1 and 12),
  year smallint not null,
  basic numeric(12, 2) not null default 0,
  hra numeric(12, 2) not null default 0,
  special_allowance numeric(12, 2) not null default 0,
  bonus numeric(12, 2) not null default 0,
  incentives numeric(12, 2) not null default 0,
  overtime numeric(12, 2) not null default 0,
  pf_deduction numeric(12, 2) not null default 0,
  esi_deduction numeric(12, 2) not null default 0,
  professional_tax numeric(12, 2) not null default 0,
  tds numeric(12, 2) not null default 0,
  gross_salary numeric(12, 2) not null default 0,
  net_salary numeric(12, 2) not null default 0,
  generated_by uuid references profiles (id),
  generated_at timestamptz not null default now(),
  unique (staff_id, month, year)
);
create index payslips_staff_id_idx on payslips (staff_id);

alter table salary_structures enable row level security;
alter table payslips enable row level security;
create policy "staff read own payslips" on payslips for select using (auth.uid() = staff_id);

-- ── Holiday calendar ────────────────────────────────────────────────
create type holiday_type as enum ('national', 'festival', 'company');

create table holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date date not null,
  type holiday_type not null default 'company',
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index holidays_date_idx on holidays (date);

alter table holidays enable row level security;
create policy "any signed-in user reads holidays" on holidays for select using (auth.uid() is not null);

-- ── Employee documents (metadata; files live in Supabase Storage) ──────
create table employee_documents (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id),
  document_type text not null,
  file_path text not null,
  file_name text not null,
  uploaded_by uuid references profiles (id),
  uploaded_at timestamptz not null default now()
);
create index employee_documents_staff_id_idx on employee_documents (staff_id);

alter table employee_documents enable row level security;
create policy "staff read own documents" on employee_documents for select using (auth.uid() = staff_id);

-- ── Company settings (singleton row) ───────────────────────────────
create table company_settings (
  id smallint primary key default 1,
  logo_url text,
  signature_url text,
  address text,
  gst_number text,
  pan_number text,
  pf_number text,
  esic_number text,
  financial_year_start_month smallint not null default 4,
  updated_at timestamptz not null default now(),
  constraint company_settings_singleton check (id = 1)
);
insert into company_settings (id) values (1);

alter table company_settings enable row level security;

-- ── Generated HR letters (audit log — the letter itself is generated
-- on demand as a PDF, not stored; this just records who/what/when) ────
create table generated_letters (
  id uuid primary key default gen_random_uuid(),
  template_slug text not null,
  staff_id uuid references profiles (id),
  employee_name text not null,
  generated_by uuid references profiles (id),
  generated_at timestamptz not null default now()
);
create index generated_letters_staff_id_idx on generated_letters (staff_id);

alter table generated_letters enable row level security;
