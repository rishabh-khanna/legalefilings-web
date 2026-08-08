-- ═══════════════════════════════════════════════════════════════════════
-- LEAVE BALANCES: per-org leave types, yearly credit, capped carry-forward
-- ═══════════════════════════════════════════════════════════════════════
-- Until now, leave_requests only recorded the fixed enum
-- sick/casual/paid/unpaid with no concept of "how many days does this
-- person actually have left." This adds:
--   * leave_types — each org defines its own named leave types (not
--     locked to the old 4), each with a yearly credit and a
--     carry-forward cap.
--   * leave_balances — one row per (staff, leave_type, calendar year),
--     storing what carried in from the previous year and how much has
--     been used; the "credited so far this year" amount is deliberately
--     NOT stored here — it's computed on read (see
--     src/lib/leave-balance.ts) from leave_types.annual_credit_days and
--     how many months have elapsed, since this repo has no cron
--     infrastructure to run a monthly accrual job. Computing it lazily
--     from elapsed time produces the identical number a monthly job
--     would have produced, without needing one.
-- The old leave_type enum column on leave_requests stays as-is — it's
-- still how "Unpaid" is represented (deliberately balance-free, always
-- uncapped, always excluded from payroll's paid-leave calculation,
-- see computeLopDays). A request against one of the new org-defined
-- types is recorded via the new leave_type_id column instead.

create table leave_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  name text not null,
  code text not null,
  annual_credit_days numeric(5,2) not null default 0,
  -- 0 = nothing carries forward; unused balance above this cap lapses
  -- at the year rollover (computed in application code, not a stored
  -- event — see getCarriedForward in src/lib/leave-balance.ts).
  carry_forward_cap numeric(5,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);
create index leave_types_organization_id_idx on leave_types (organization_id);

alter table leave_requests add column leave_type_id uuid references leave_types (id);

create table leave_balances (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id),
  leave_type_id uuid not null references leave_types (id),
  organization_id uuid not null references organizations (id),
  year integer not null,
  -- Fixed once, when this year's row is first created (lazily, on first
  -- balance lookup or leave request in that year) — min(previous year's
  -- unused balance, that leave type's cap). Never recomputed after.
  carried_forward numeric(6,2) not null default 0,
  -- Incremented when a request against this type is approved. There's
  -- no decrement path — leave_requests has no un-approve transition
  -- (see PATCH /api/leave-requests/[id]: pending -> approved is final).
  used numeric(6,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (staff_id, leave_type_id, year)
);
create index leave_balances_staff_id_idx on leave_balances (staff_id);

alter table leave_types enable row level security;
create policy "org members read own leave types" on leave_types for select using (
  is_platform_admin() or organization_id = current_organization_id()
);
create policy "admins write own leave types" on leave_types for all using (
  is_platform_admin()
  or (organization_id = current_organization_id() and exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin'))
);

alter table leave_balances enable row level security;
create policy "staff read own leave balances" on leave_balances for select using (staff_id = auth.uid());
create policy "admins read org leave balances" on leave_balances for select using (
  is_platform_admin()
  or (organization_id = current_organization_id() and exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin'))
);

-- Every existing org gets two sensible defaults so nobody's Leave page
-- goes from "pick a type" to "no types configured" — admin can rename,
-- retune, or deactivate these, or add more, from Admin > Leave Types.
insert into leave_types (organization_id, name, code, annual_credit_days, carry_forward_cap)
select id, 'Casual Leave', 'CL', 12, 5 from organizations
union all
select id, 'Sick Leave', 'SL', 12, 5 from organizations;
