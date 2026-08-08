-- ═══════════════════════════════════════════════════════════════════════
-- DELEGATED CRM TOOL ACCESS
-- ═══════════════════════════════════════════════════════════════════════
-- Lets an org admin hand a specific staff member access to one normally
-- admin-only (or group_leader-only) section — e.g. "let this rater help
-- with Payroll this month" — without promoting them to admin/group_leader
-- and picking up every other section that role would also unlock.
-- tool_key values mirror the delegable sections in src/lib/tool-grants.ts
-- (kept in sync manually — this table has no FK to a tools table since
-- the set of tools is small, fixed, and defined in application code).
create table staff_tool_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  staff_id uuid not null references profiles (id),
  tool_key text not null,
  granted_by uuid references profiles (id),
  -- null = stays granted until an admin revokes it; set = auto-expires,
  -- same optional-expiry pattern as organizations.access_expires_at.
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
-- One row per (staff, tool) — re-granting updates the existing row
-- (new expiry, new granted_by) instead of accumulating duplicates.
create unique index staff_tool_grants_staff_tool_idx on staff_tool_grants (staff_id, tool_key);
create index staff_tool_grants_org_idx on staff_tool_grants (organization_id);

-- Admin-side grant/revoke management goes through the service-role API
-- (src/app/api/admin/tool-grants) — same pattern as every other
-- admin-only table in this schema. The one browser-session read this
-- needs is a staff member checking their OWN active grants, both in
-- proxy.ts (page-level gate) and DashboardShell (nav visibility) — full
-- org visibility would leak who's been granted what to people who don't
-- manage them.
alter table staff_tool_grants enable row level security;
create policy "staff read own tool grants" on staff_tool_grants
  for select using (staff_id = auth.uid());
