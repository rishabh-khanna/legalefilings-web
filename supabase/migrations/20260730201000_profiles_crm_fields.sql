-- The dashboard's CRM contact list is just customer profiles, enriched with
-- a couple of fields the mock version had (company name, an admin-facing
-- pipeline status) — no separate "contacts" table, to avoid duplicating
-- data that already lives on profiles/orders.
alter table profiles add column company text;
alter table profiles add column crm_status text not null default 'lead'
  check (crm_status in ('lead', 'active', 'past_client'));
