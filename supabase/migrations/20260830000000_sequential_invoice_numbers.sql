-- Sequential, per-organization, per-financial-year invoice numbering.
--
-- Numbers were previously `INV-YYYYMM-{last 6 digits of epoch ms}` —
-- effectively random within the month. Rule 46(b) of the CGST Rules
-- requires a *consecutive serial number* per series, so the old scheme
-- was not defensible in a GST audit. It also collided across tenants:
-- invoice_number carried a GLOBAL unique constraint while every org
-- defaults to the same 'INV' prefix, so one tenant's number could block
-- another's, surfacing as a raw 500 mid-invoice-creation.
--
-- Existing invoices are deliberately NOT renumbered. They have already
-- been issued to customers and sit in their books; rewriting them would
-- be worse than the inconsistency. The new series starts alongside them
-- and the formats are visibly different, so they cannot collide.

create table invoice_number_counters (
  organization_id uuid not null references organizations (id) on delete cascade,
  series text not null,
  last_number integer not null default 0,
  primary key (organization_id, series)
);

-- Atomic allocation. INSERT .. ON CONFLICT DO UPDATE takes a row lock,
-- so two invoices created in the same instant serialise here and get
-- distinct consecutive numbers instead of racing to the same one — the
-- reason this is a function against a counter table rather than a
-- read-max-then-add-one in application code.
create or replace function next_invoice_number(p_org uuid, p_series text)
returns integer as $$
declare
  n integer;
begin
  insert into invoice_number_counters (organization_id, series, last_number)
  values (p_org, p_series, 1)
  on conflict (organization_id, series)
  do update set last_number = invoice_number_counters.last_number + 1
  returning last_number into n;
  return n;
end;
$$ language plpgsql;

-- Uniqueness scoped to the tenant. Two organizations issuing their own
-- INV/2026-27/0001 is correct and expected; the old global constraint
-- made that a hard failure.
alter table invoices drop constraint if exists invoices_invoice_number_key;
create unique index invoices_org_invoice_number_idx
  on invoices (organization_id, invoice_number);
