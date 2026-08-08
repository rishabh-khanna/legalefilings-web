-- ═══════════════════════════════════════════════════════════════════════
-- MULTI-TENANCY, PHASE 2: ORG PROVISIONING
-- ═══════════════════════════════════════════════════════════════════════
-- Fixes the one thing Phase 0 deliberately deferred: company_settings.id
-- was a smallint hardwired to `default 1` (the old single-company
-- singleton pattern). Every organization now gets its own row keyed by
-- organization_id — nothing in the app ever reads company_settings.id
-- (every query already goes by organization_id), so the simplest fix is
-- to drop the id column entirely and make organization_id itself the
-- primary key. Without this, provisioning a second organization's
-- company_settings row would fail outright (duplicate primary key on
-- insert).

alter table company_settings drop constraint company_settings_pkey;
alter table company_settings drop constraint company_settings_organization_id_unique;
alter table company_settings drop column id;
alter table company_settings add primary key (organization_id);
