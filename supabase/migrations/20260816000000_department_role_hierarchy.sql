-- ═══════════════════════════════════════════════════════════════════════
-- CONFIGURABLE STAFF HIERARCHY: DEPARTMENTS + DEPARTMENT ROLES
-- ═══════════════════════════════════════════════════════════════════════
-- Today's staff_level enum ("rater" | "leader" | "group_leader") is
-- hardcoded to those three names everywhere, and has no department
-- dimension. This adds departments (per organization) and a per-
-- department, admin-configurable ladder of role titles ("Lead",
-- "Manager", "Senior Manager", or whatever a company actually calls
-- them), each carrying a rank (display/ordering only) and an
-- is_manager_level flag.
--
-- This is deliberately additive, not a replacement:
--   - reports_to (profiles) stays the ONE mechanism that decides who
--     manages whom and who can approve what (see canApproveFor,
--     canManageStaff in reporting-chain.ts) — it's already arbitrary-
--     depth and role-name-agnostic, so a longer/renamed ladder needs no
--     change there at all.
--   - staff_level stays on profiles, untouched, as a legacy fallback for
--     any profile not yet assigned a department_role — nothing that
--     already depends on it breaks.
--   - department_role_id is what roleLabel() and the sidebar's
--     Team-Management-visibility check now prefer when present,
--     falling back to staff_level when it isn't.
create table departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

-- rank is display/ordering only (lower = more junior) — reports_to is
-- still what actually decides who approves whom, so there's no need for
-- rank to be globally comparable across departments.
create table department_roles (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references departments (id) on delete cascade,
  title text not null,
  rank smallint not null,
  is_manager_level boolean not null default false,
  created_at timestamptz not null default now(),
  unique (department_id, title),
  unique (department_id, rank)
);

alter table profiles add column department_id uuid references departments (id);
alter table profiles add column department_role_id uuid references department_roles (id);

alter table departments enable row level security;
alter table department_roles enable row level security;

-- Anyone in the org can see the department/role list (it's org
-- structure, not sensitive data); only an admin (or platform_admin) can
-- create/edit/delete departments and roles.
create policy "org reads departments" on departments for select using (
  is_platform_admin() or organization_id = current_organization_id()
);
create policy "admin writes departments" on departments for all using (
  is_platform_admin() or (
    organization_id = current_organization_id()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
  )
) with check (
  is_platform_admin() or (
    organization_id = current_organization_id()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
  )
);

create policy "org reads department roles" on department_roles for select using (
  is_platform_admin() or exists (
    select 1 from departments d where d.id = department_roles.department_id and d.organization_id = current_organization_id()
  )
);
create policy "admin writes department roles" on department_roles for all using (
  is_platform_admin() or exists (
    select 1 from departments d
    join profiles p on p.id = auth.uid()
    where d.id = department_roles.department_id and d.organization_id = current_organization_id() and p.account_type = 'admin'
  )
) with check (
  is_platform_admin() or exists (
    select 1 from departments d
    join profiles p on p.id = auth.uid()
    where d.id = department_roles.department_id and d.organization_id = current_organization_id() and p.account_type = 'admin'
  )
);

-- Extends the existing admin-controlled-fields guard (20260804000000)
-- rather than adding a second trigger — that one already has the
-- auth.role() = 'service_role' bypass our admin API routes rely on
-- (they write via the service-role client, not a user session); a
-- fresh trigger without that bypass would have blocked every legitimate
-- department/role assignment made through the app itself.
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
     or new.department_id is distinct from old.department_id
     or new.department_role_id is distinct from old.department_role_id
  then
    raise exception 'Only an admin can change this field';
  end if;
  return new;
end;
$$ language plpgsql security definer;
