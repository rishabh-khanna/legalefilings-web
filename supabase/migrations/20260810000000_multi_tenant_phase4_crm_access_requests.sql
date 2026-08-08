-- ═══════════════════════════════════════════════════════════════════════
-- MULTI-TENANCY, PHASE 4: SELF-SERVICE CRM ACCESS REQUESTS
-- ═══════════════════════════════════════════════════════════════════════
-- Closes the gap Phases 0-3 left open: a paying customer had no way to
-- actually reach a CRM — only a platform_admin could hand-provision an
-- org. This adds a request/approve flow: a customer with at least one
-- paid purchase can request their own workspace; a platform_admin
-- approves it, which promotes their existing account to admin of a
-- brand-new org (same login, no separate credentials). Access is
-- time-boxed (bundled free with a plan purchase, not permanent) rather
-- than a lifetime grant, since renewal is a real future business
-- decision, not something to assume away.

alter table organizations add column access_expires_at timestamptz;

-- organizations has had RLS enabled with zero policies since Phase 0
-- (service-role only, same as every other table here) — but the expiry
-- gate in proxy.ts runs on the anon-key browser session (middleware has
-- no service-role access), so it needs to actually be able to read the
-- signed-in user's own org row, or the gate silently never fires.
create policy "members read own organization" on organizations
  for select using (
    id in (select organization_id from profiles where id = auth.uid())
  );

create table org_access_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references profiles (id),
  organization_name text not null,
  -- The purchase that made this request eligible — kept for audit, so
  -- an approval can always be traced back to a real paid order, not
  -- just an admin's say-so.
  qualifying_order_id uuid references orders (id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles (id),
  review_note text,
  -- Filled in once approved — the org that got created for this request.
  organization_id uuid references organizations (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index org_access_requests_requested_by_idx on org_access_requests (requested_by);
create trigger org_access_requests_set_updated_at before update on org_access_requests
  for each row execute function set_updated_at();

-- Service-role only (API-layer enforcement, same pattern as
-- company_settings/generated_letters) — RLS enabled with zero policies
-- means default-deny for any direct browser-session query.
alter table org_access_requests enable row level security;
