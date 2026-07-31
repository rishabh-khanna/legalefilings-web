-- The initial migration only covered "a customer can read their own
-- row" — nothing let staff/admin read across all customers, which the
-- CRM board and admin-facing dashboard views need. Server code that uses
-- the secret key (API routes) already bypasses RLS entirely; these
-- policies are for direct queries made with the publishable key (Server
-- Components using the user's own session, e.g. dashboard pages).
create or replace function is_staff_or_admin() returns boolean as $$
  select exists (
    select 1 from profiles p where p.id = auth.uid() and p.account_type in ('staff', 'admin')
  );
$$ language sql stable security definer set search_path = public;

create policy "staff read all profiles" on profiles
  for select using (is_staff_or_admin());

create policy "staff read all leads" on leads
  for select using (is_staff_or_admin());
create policy "staff write leads" on leads
  for all using (is_staff_or_admin());

create policy "staff read all orders" on orders
  for select using (is_staff_or_admin());
create policy "staff write orders" on orders
  for all using (is_staff_or_admin());

create policy "staff read all invoices" on invoices
  for select using (is_staff_or_admin());
create policy "staff write invoices" on invoices
  for all using (is_staff_or_admin());

create policy "customers read own invoice line items" on invoice_line_items
  for select using (
    exists (select 1 from invoices i where i.id = invoice_id and i.customer_id = auth.uid())
  );
create policy "staff read all invoice line items" on invoice_line_items
  for select using (is_staff_or_admin());
create policy "staff write invoice line items" on invoice_line_items
  for all using (is_staff_or_admin());
