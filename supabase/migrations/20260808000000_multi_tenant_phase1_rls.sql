-- ═══════════════════════════════════════════════════════════════════════
-- MULTI-TENANCY, PHASE 1: RLS ENFORCEMENT
-- ═══════════════════════════════════════════════════════════════════════
-- Phase 0 attached every row to an organization but changed no access
-- behavior. This migration is where "admin" stops meaning "sees
-- everything" and starts meaning "sees everything in their own
-- organization" — every policy below that used to say is_staff_or_admin()
-- or "account_type = 'admin'" alone now also requires same-organization
-- membership, with is_platform_admin() as the one deliberate bypass
-- (Legal-Efilings-operator support/billing visibility across every org).
--
-- RLS is this app's secondary backstop, not the primary enforcement —
-- almost every real read/write goes through an API route using the
-- service-role key (which bypasses RLS entirely) and does its own
-- authorization check. That app-level half of Phase 1 is the companion
-- code change happening alongside this migration. Both layers need to
-- agree, which is why this migration exists at all rather than relying
-- on the API layer alone.

create or replace function current_organization_id() returns uuid as $$
  select organization_id from profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

create or replace function is_platform_admin() returns boolean as $$
  select coalesce((select is_platform_admin from profiles where id = auth.uid()), false);
$$ language sql stable security definer set search_path = public;

-- ── leads ────────────────────────────────────────────────────────────
drop policy "staff read all leads" on leads;
create policy "staff read org leads" on leads for select using (
  is_staff_or_admin() and (is_platform_admin() or organization_id = current_organization_id())
);
drop policy "staff write leads" on leads;
create policy "staff write org leads" on leads for all using (
  is_staff_or_admin() and (is_platform_admin() or organization_id = current_organization_id())
);

-- ── orders ───────────────────────────────────────────────────────────
-- "staff read scoped orders" (20260804010000) already replaced the
-- original blanket read policy with reporting-chain scoping; this adds
-- the organization gate on top of that, same shape as leads above.
drop policy "staff read scoped orders" on orders;
create policy "staff read org orders" on orders for select using (
  is_staff_or_admin() and (is_platform_admin() or organization_id = current_organization_id()) and (
    exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
    or assigned_to is null
    or is_in_reporting_chain(assigned_to, auth.uid())
  )
);
drop policy "staff write orders" on orders;
create policy "staff write org orders" on orders for all using (
  is_staff_or_admin() and (is_platform_admin() or organization_id = current_organization_id())
);

-- ── invoices ─────────────────────────────────────────────────────────
drop policy "staff read scoped invoices" on invoices;
create policy "staff read org invoices" on invoices for select using (
  is_staff_or_admin() and (is_platform_admin() or organization_id = current_organization_id()) and (
    exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
    or created_by is null
    or is_in_reporting_chain(created_by, auth.uid())
  )
);
drop policy "staff write invoices" on invoices;
create policy "staff write org invoices" on invoices for all using (
  is_staff_or_admin() and (is_platform_admin() or organization_id = current_organization_id())
);

-- ── invoice_line_items / invoice_events / invoice_payments — no own
-- organization_id column by design (Phase 0); org membership is reached
-- through the parent invoice.
drop policy "staff read all invoice line items" on invoice_line_items;
create policy "staff read org invoice line items" on invoice_line_items for select using (
  is_staff_or_admin() and exists (
    select 1 from invoices i where i.id = invoice_id and (is_platform_admin() or i.organization_id = current_organization_id())
  )
);
drop policy "staff write invoice line items" on invoice_line_items;
create policy "staff write org invoice line items" on invoice_line_items for all using (
  is_staff_or_admin() and exists (
    select 1 from invoices i where i.id = invoice_id and (is_platform_admin() or i.organization_id = current_organization_id())
  )
);

drop policy "staff read invoice events" on invoice_events;
create policy "staff read org invoice events" on invoice_events for select using (
  is_staff_or_admin() and exists (
    select 1 from invoices i where i.id = invoice_id and (is_platform_admin() or i.organization_id = current_organization_id())
  )
);

drop policy "staff read scoped invoice payments" on invoice_payments;
create policy "staff read org invoice payments" on invoice_payments for select using (
  is_staff_or_admin() and exists (
    select 1 from invoices i
    where i.id = invoice_id
      and (is_platform_admin() or i.organization_id = current_organization_id())
      and (
        exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
        or i.created_by is null
        or is_in_reporting_chain(i.created_by, auth.uid())
      )
  )
);

-- ── attendance / leave / corrections — self-read policies are already
-- organization-safe (a person's own row is definitionally their own
-- org's); only the admin "read/update all" policies need the org gate.
drop policy "admins read all attendance" on attendance_events;
create policy "admins read org attendance" on attendance_events for select using (
  is_platform_admin() or (
    organization_id = current_organization_id()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
  )
);

drop policy "admins read all leave requests" on leave_requests;
create policy "admins read org leave requests" on leave_requests for select using (
  is_platform_admin() or (
    organization_id = current_organization_id()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
  )
);
drop policy "admins update leave requests" on leave_requests;
create policy "admins update org leave requests" on leave_requests for update using (
  is_platform_admin() or (
    organization_id = current_organization_id()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
  )
);

drop policy "admins read all corrections" on attendance_corrections;
create policy "admins read org corrections" on attendance_corrections for select using (
  is_platform_admin() or (
    organization_id = current_organization_id()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
  )
);
drop policy "admins update corrections" on attendance_corrections;
create policy "admins update org corrections" on attendance_corrections for update using (
  is_platform_admin() or (
    organization_id = current_organization_id()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
  )
);

-- ── employee_documents ──────────────────────────────────────────────
-- Defense in depth on top of the existing reporting-chain check — a
-- manager's reporting chain should already never cross an org boundary
-- (staff creation enforces that at the app level), but this makes it
-- impossible even if that ever slipped.
drop policy "managers read team documents" on employee_documents;
create policy "managers read org team documents" on employee_documents for select using (
  is_in_reporting_chain(staff_id, auth.uid())
  and (is_platform_admin() or organization_id = current_organization_id())
);

-- ── holidays ─────────────────────────────────────────────────────────
-- Was "any signed-in user" with NO organization check at all — every
-- signed-in person, from any org, could read every other org's holiday
-- calendar. Low-sensitivity data, but still a real cross-tenant leak.
drop policy "any signed-in user reads holidays" on holidays;
create policy "org members read own holidays" on holidays for select using (
  is_platform_admin() or organization_id = current_organization_id()
);

-- ── product_service_master ──────────────────────────────────────────
-- Each org now has its own catalog (Phase 0 gave every org its own
-- backfilled copy) — this was reading every org's catalog before.
drop policy "staff read catalog" on product_service_master;
create policy "staff read org catalog" on product_service_master for select using (
  is_staff_or_admin() and (is_platform_admin() or organization_id = current_organization_id())
);

-- ── company_gst_registrations ───────────────────────────────────────
drop policy "staff read gst registrations" on company_gst_registrations;
create policy "staff read org gst registrations" on company_gst_registrations for select using (
  is_staff_or_admin() and (is_platform_admin() or organization_id = current_organization_id())
);

-- ── recurring_invoice_templates ─────────────────────────────────────
drop policy "staff read scoped recurring templates" on recurring_invoice_templates;
create policy "staff read org recurring templates" on recurring_invoice_templates for select using (
  is_staff_or_admin() and (is_platform_admin() or organization_id = current_organization_id()) and (
    exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
    or created_by is null
    or is_in_reporting_chain(created_by, auth.uid())
  )
);
