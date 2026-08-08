-- ═══════════════════════════════════════════════════════════════════════
-- MULTI-TENANCY, PHASE 0: FOUNDATION
-- ═══════════════════════════════════════════════════════════════════════
-- Adds the organization concept and attaches every existing row to one
-- real organization ("Legal Efilings" itself), but changes NO access
-- behavior yet — every RLS policy and API route still works exactly as
-- it did before this migration. Enforcement (making "admin" mean "admin
-- of their org" instead of "admin of everything") is Phase 1, deliberately
-- separate: this migration is pure schema + backfill, safe to run and
-- verify on its own before anything actually depends on organization_id.
--
-- Written as explicit per-table statements (not a dynamic loop) so if
-- anything fails partway through, it's obvious exactly which statement
-- and table — same style as every other migration in this repo.
--
-- After this runs, you (the operator) need to run ONE manual statement
-- to mark your own account as platform_admin — see the bottom of this
-- file. I don't have your email/user id, so that step can't be baked in
-- here.

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  -- 'internal' is Legal Efilings' own organization — every other org is
  -- a paying customer's own workspace. Kept as an explicit tier (not
  -- just "the first org") so app code can tell them apart without
  -- hardcoding a specific id.
  plan_tier text not null default 'internal' check (plan_tier in ('internal', 'starter', 'business', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_set_updated_at before update on organizations
  for each row execute function set_updated_at();

alter table organizations enable row level security;

-- Bootstrap: Legal Efilings' own organization, created_by left null since
-- no profile exists yet that could "own" the very first org.
insert into organizations (name, slug, plan_tier) values ('Legal Efilings', 'legal-efilings', 'internal');

-- ── platform_admin: a second, higher admin tier ─────────────────────────
-- An org's own `admin` (account_type) sees everything within their org,
-- same as today — that role doesn't change. platform_admin is Legal
-- Efilings-operator-only: it bypasses org scoping entirely for support/
-- billing visibility across every org. Deliberately a separate boolean,
-- not a new account_type value, so "is this person an org admin" and
-- "is this person allowed to see other orgs" stay two independent
-- questions — a platform_admin is still a member of one org (their own
-- profile row still needs an organization_id) but can also see others.
alter table profiles add column organization_id uuid references organizations (id);
alter table profiles add column is_platform_admin boolean not null default false;

update profiles set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table profiles alter column organization_id set not null;
create index profiles_organization_id_idx on profiles (organization_id);

-- Close the obvious self-privilege-escalation hole: without this, a user
-- could PATCH their own profile to move themselves into a different
-- organization, or grant themselves platform_admin, via a direct
-- authenticated request — the same class of bug the existing trigger
-- already prevents for account_type/staff_level/reports_to/etc.
create or replace function prevent_self_privilege_update()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.account_type is distinct from old.account_type
     or new.customer_tier is distinct from old.customer_tier
     or new.staff_level is distinct from old.staff_level
     or new.reports_to is distinct from old.reports_to
     or new.employee_id is distinct from old.employee_id
     or new.department is distinct from old.department
     or new.designation is distinct from old.designation
     or new.date_of_joining is distinct from old.date_of_joining
     or new.uan_number is distinct from old.uan_number
     or new.esic_number is distinct from old.esic_number
     or new.crm_status is distinct from old.crm_status
     or new.organization_id is distinct from old.organization_id
     or new.is_platform_admin is distinct from old.is_platform_admin
  then
    raise exception 'Only an admin can change this field';
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- ── organization_id on every other top-level, org-scoped table ─────────
-- Child/history tables (lead_status_history, order_status_history,
-- invoice_line_items, invoice_events, invoice_payments,
-- invoice_attachments) deliberately do NOT get their own copy — their
-- org is always their parent row's org, and duplicating it here would
-- just be another place for it to drift out of sync. RLS in Phase 1
-- reaches their org through a join to the parent instead.

alter table leads add column organization_id uuid references organizations (id);
update leads set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table leads alter column organization_id set not null;
create index leads_organization_id_idx on leads (organization_id);

alter table orders add column organization_id uuid references organizations (id);
update orders set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table orders alter column organization_id set not null;
create index orders_organization_id_idx on orders (organization_id);

alter table invoices add column organization_id uuid references organizations (id);
update invoices set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table invoices alter column organization_id set not null;
create index invoices_organization_id_idx on invoices (organization_id);

alter table account_requests add column organization_id uuid references organizations (id);
update account_requests set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table account_requests alter column organization_id set not null;
create index account_requests_organization_id_idx on account_requests (organization_id);

alter table salary_structures add column organization_id uuid references organizations (id);
update salary_structures set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table salary_structures alter column organization_id set not null;
create index salary_structures_organization_id_idx on salary_structures (organization_id);

alter table payslips add column organization_id uuid references organizations (id);
update payslips set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table payslips alter column organization_id set not null;
create index payslips_organization_id_idx on payslips (organization_id);

alter table holidays add column organization_id uuid references organizations (id);
update holidays set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table holidays alter column organization_id set not null;
create index holidays_organization_id_idx on holidays (organization_id);

alter table employee_documents add column organization_id uuid references organizations (id);
update employee_documents set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table employee_documents alter column organization_id set not null;
create index employee_documents_organization_id_idx on employee_documents (organization_id);

alter table generated_letters add column organization_id uuid references organizations (id);
update generated_letters set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table generated_letters alter column organization_id set not null;
create index generated_letters_organization_id_idx on generated_letters (organization_id);

alter table attendance_events add column organization_id uuid references organizations (id);
update attendance_events set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table attendance_events alter column organization_id set not null;
create index attendance_events_organization_id_idx on attendance_events (organization_id);

alter table leave_requests add column organization_id uuid references organizations (id);
update leave_requests set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table leave_requests alter column organization_id set not null;
create index leave_requests_organization_id_idx on leave_requests (organization_id);

alter table attendance_corrections add column organization_id uuid references organizations (id);
update attendance_corrections set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table attendance_corrections alter column organization_id set not null;
create index attendance_corrections_organization_id_idx on attendance_corrections (organization_id);

alter table product_service_master add column organization_id uuid references organizations (id);
update product_service_master set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table product_service_master alter column organization_id set not null;
create index product_service_master_organization_id_idx on product_service_master (organization_id);

alter table company_gst_registrations add column organization_id uuid references organizations (id);
update company_gst_registrations set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table company_gst_registrations alter column organization_id set not null;
create index company_gst_registrations_organization_id_idx on company_gst_registrations (organization_id);

alter table recurring_invoice_templates add column organization_id uuid references organizations (id);
update recurring_invoice_templates set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table recurring_invoice_templates alter column organization_id set not null;
create index recurring_invoice_templates_organization_id_idx on recurring_invoice_templates (organization_id);

-- ── company_settings: was a hard singleton (id forced to 1 by a check
-- constraint), needs to become one row per organization instead. Kept
-- minimal for Phase 0 — the `id smallint default 1` column stays as-is
-- for now (harmless while only one org exists); actually inserting a
-- second organization's settings row will need that default fixed,
-- which is Phase 2's problem (org provisioning), not this migration's.
alter table company_settings drop constraint company_settings_singleton;
alter table company_settings add column organization_id uuid references organizations (id);
update company_settings set organization_id = (select id from organizations where slug = 'legal-efilings');
alter table company_settings alter column organization_id set not null;
alter table company_settings add constraint company_settings_organization_id_unique unique (organization_id);

-- ═══════════════════════════════════════════════════════════════════════
-- MANUAL STEP — run this yourself, once, for your own account:
--
--   update profiles set is_platform_admin = true where id = (
--     select id from auth.users where email = 'your-actual-admin-email@example.com'
--   );
--
-- Nothing reads is_platform_admin yet (that's Phase 1), so this is safe
-- to run any time before or after Phase 1 ships.
-- ═══════════════════════════════════════════════════════════════════════
