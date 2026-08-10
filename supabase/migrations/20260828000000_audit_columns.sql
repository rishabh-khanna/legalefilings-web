-- Audit trail (created_by / updated_at / updated_by) was inconsistent
-- across tables — some had a domain-specific actor column already
-- (uploaded_by, reviewed_by, generated_by, etc.), some had created_at
-- but no updated_at, and a handful (departments, department_roles,
-- leave_types, company_gst_registrations) had no actor tracking of any
-- kind. This backfills the real gaps: who created a row, and when it
-- was last touched. Existing rows get created_by = null (unknowable —
-- nothing in the schema recorded it before now) rather than a guessed
-- value; updated_at backfills to created_at (or now() where there's no
-- created_at) as the closest honest default, then the trigger keeps it
-- current from here on.

alter table departments add column created_by uuid references profiles (id);
alter table departments add column updated_at timestamptz not null default now();
update departments set updated_at = created_at;
create trigger departments_set_updated_at before update on departments
  for each row execute function set_updated_at();

alter table department_roles add column created_by uuid references profiles (id);
alter table department_roles add column updated_at timestamptz not null default now();
update department_roles set updated_at = created_at;
create trigger department_roles_set_updated_at before update on department_roles
  for each row execute function set_updated_at();

alter table leave_types add column created_by uuid references profiles (id);
alter table leave_types add column updated_at timestamptz not null default now();
update leave_types set updated_at = created_at;
create trigger leave_types_set_updated_at before update on leave_types
  for each row execute function set_updated_at();

alter table company_gst_registrations add column created_by uuid references profiles (id);
alter table company_gst_registrations add column updated_at timestamptz not null default now();
update company_gst_registrations set updated_at = created_at;
create trigger company_gst_registrations_set_updated_at before update on company_gst_registrations
  for each row execute function set_updated_at();

-- email_failures: "created_by" doesn't apply (a failed send is a system
-- event, not something a person creates) but resolving one is a human
-- action that was tracked only as a boolean, with no record of who.
alter table email_failures add column updated_at timestamptz not null default now();
alter table email_failures add column resolved_by uuid references profiles (id);
update email_failures set updated_at = created_at;
create trigger email_failures_set_updated_at before update on email_failures
  for each row execute function set_updated_at();

-- invoices already has created_by (added 20260731050000) but no
-- updated_at — relevant since a draft invoice can be edited in place
-- (PATCH /api/invoices/[id]) with no record of when that last happened.
alter table invoices add column updated_at timestamptz not null default now();
update invoices set updated_at = created_at;
create trigger invoices_set_updated_at before update on invoices
  for each row execute function set_updated_at();

-- company_settings already has updated_at (set manually in the PATCH
-- route, no trigger) but never recorded which admin last changed it.
alter table company_settings add column updated_by uuid references profiles (id);
