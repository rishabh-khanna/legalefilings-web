-- "staff read all orders"/"staff read all invoices" (20260730204000) let
-- ANY staff member — including a rater — read every order and invoice in
-- the company via a direct table query, not just their own/their team's.
-- Every current UI path already scopes correctly in application code
-- (getReportingChainIds in /dashboard/orders, /api/invoices), but RLS is
-- the actual security backstop — a staff member with their own valid
-- session token and the publishable key could bypass the app entirely
-- and pull the whole order/invoice book via a raw Supabase client call.
-- This closes that gap by making the policy itself reporting-chain-aware,
-- mirroring the same walk-the-chain logic reporting-chain.ts already
-- uses in code.
create or replace function is_in_reporting_chain(target_id uuid, viewer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive chain as (
    select id from profiles where reports_to = viewer_id
    union all
    select p.id from profiles p join chain c on p.reports_to = c.id
  )
  select target_id = viewer_id or exists (select 1 from chain where id = target_id);
$$;

drop policy "staff read all orders" on orders;
create policy "staff read scoped orders" on orders for select using (
  is_staff_or_admin() and (
    exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
    or assigned_to is null
    or is_in_reporting_chain(assigned_to, auth.uid())
  )
);

drop policy "staff read all invoices" on invoices;
create policy "staff read scoped invoices" on invoices for select using (
  is_staff_or_admin() and (
    exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
    or created_by is null
    or is_in_reporting_chain(created_by, auth.uid())
  )
);

-- The "staff write X" ALL-command policies stay blanket-staff — every
-- actual write today goes through an API route using the service-role
-- key (which bypasses RLS and does its own app-level authorization
-- check, already audited), so RLS is a secondary backstop there and not
-- the thing narrowing who can write what. Only SELECT was the real gap.
