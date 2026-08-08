-- Invoice management rebuild: GST-compliant invoicing with a
-- product/service master (HSN/SAC + default rate lookup), full tax
-- breakdown (CGST+SGST for intra-state, IGST for inter-state), discounts,
-- other charges, TDS, credit/debit notes, multi-payment tracking (so
-- partial payments have a real history, not just a single "paid" flag),
-- and attachments. Extends the existing invoices/invoice_line_items
-- tables rather than replacing them — orders/payments/customer-facing
-- read paths built on those tables keep working unchanged.

-- ── Product / Service master ────────────────────────────────────────────
-- Lets staff pick a catalog item on an invoice line and have HSN/SAC +
-- GST rate + unit auto-fill, instead of re-typing them (and getting them
-- wrong) on every invoice.
create type catalog_item_type as enum ('product', 'service');

create table product_service_master (
  id uuid primary key default gen_random_uuid(),
  type catalog_item_type not null,
  name text not null,
  hsn_sac_code text,
  gst_rate numeric(5, 2) not null default 18,
  unit text not null default 'Nos',
  default_rate numeric(12, 2),
  description text,
  active boolean not null default true,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger product_service_master_set_updated_at before update on product_service_master
  for each row execute function set_updated_at();
create index product_service_master_active_idx on product_service_master (active);

alter table product_service_master enable row level security;
create policy "staff read catalog" on product_service_master for select using (is_staff_or_admin());

-- ── Company settings: state (for intra vs inter-state GST), bank
-- details (for the "Bank Details" section on the PDF + UPI QR), and a
-- default invoice-notes/terms block ─────────────────────────────────────
alter table company_settings add column state text;
alter table company_settings add column state_code text;
alter table company_settings add column bank_name text;
alter table company_settings add column bank_account_number text;
alter table company_settings add column bank_ifsc text;
alter table company_settings add column bank_branch text;
alter table company_settings add column upi_id text;
alter table company_settings add column default_invoice_notes text;
alter table company_settings add column invoice_number_prefix text not null default 'INV';

-- ── Customer billing fields (GST invoicing needs more than name+phone) ──
alter table profiles add column gstin text;
alter table profiles add column state_code text;
alter table profiles add column billing_address text;
alter table profiles add column shipping_address text;

-- ── Invoices: type, tax/charge breakdown, payment terms, snapshot of
-- customer billing details at issue time (so a later profile edit
-- doesn't rewrite the legal record of what was actually invoiced) ───────
alter type invoice_status add value if not exists 'partially_paid';

create type invoice_type as enum ('gst', 'non_gst', 'export', 'proforma', 'credit_note', 'debit_note');
alter table invoices add column invoice_type invoice_type not null default 'gst';
alter table invoices add column related_invoice_id uuid references invoices (id);

alter table invoices add column place_of_supply text;
alter table invoices add column reverse_charge boolean not null default false;
alter table invoices add column payment_terms text not null default 'Immediate';

alter table invoices add column discount_type text check (discount_type in ('flat', 'percentage'));
alter table invoices add column discount_value numeric(12, 2) not null default 0;
alter table invoices add column discount_amount numeric(12, 2) not null default 0;

alter table invoices add column freight numeric(12, 2) not null default 0;
alter table invoices add column packing numeric(12, 2) not null default 0;
alter table invoices add column courier numeric(12, 2) not null default 0;
alter table invoices add column other_charges numeric(12, 2) not null default 0;

alter table invoices add column tds_rate numeric(5, 2) not null default 0;
alter table invoices add column tds_amount numeric(12, 2) not null default 0;

alter table invoices add column cgst_total numeric(12, 2) not null default 0;
alter table invoices add column sgst_total numeric(12, 2) not null default 0;
alter table invoices add column igst_total numeric(12, 2) not null default 0;

alter table invoices add column notes text;

-- Snapshot of the customer's billing details as of invoice creation —
-- what actually goes on the legal document, independent of later edits
-- to their profile.
alter table invoices add column customer_gstin text;
alter table invoices add column customer_pan text;
alter table invoices add column customer_state text;
alter table invoices add column customer_state_code text;
alter table invoices add column customer_billing_address text;
alter table invoices add column customer_shipping_address text;

-- ── Invoice line items: product/service link, HSN/SAC, per-line GST
-- split, discount ────────────────────────────────────────────────────────
alter table invoice_line_items add column catalog_item_id uuid references product_service_master (id);
alter table invoice_line_items add column item_type catalog_item_type not null default 'service';
alter table invoice_line_items add column hsn_sac_code text;
alter table invoice_line_items add column unit text not null default 'Nos';
alter table invoice_line_items add column gst_rate numeric(5, 2) not null default 0;
alter table invoice_line_items add column discount numeric(12, 2) not null default 0;
alter table invoice_line_items add column taxable_value numeric(12, 2) not null default 0;
alter table invoice_line_items add column cgst_amount numeric(12, 2) not null default 0;
alter table invoice_line_items add column sgst_amount numeric(12, 2) not null default 0;
alter table invoice_line_items add column igst_amount numeric(12, 2) not null default 0;

-- ── Payments: a real history instead of a single paid_at/status flag —
-- partial payments are common (customer pays half up front) and each one
-- needs its own date/mode/reference for reconciliation. Invoice status
-- (paid/partially_paid/overdue) is derived from this table by the app,
-- not stored redundantly here.
create table invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  payment_date date not null default current_date,
  payment_mode text not null,
  transaction_id text,
  amount numeric(12, 2) not null check (amount > 0),
  recorded_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index invoice_payments_invoice_id_idx on invoice_payments (invoice_id);

alter table invoice_payments enable row level security;
create policy "staff read scoped invoice payments" on invoice_payments for select using (
  is_staff_or_admin() and exists (
    select 1 from invoices i
    where i.id = invoice_id
      and (
        exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
        or i.created_by is null
        or is_in_reporting_chain(i.created_by, auth.uid())
      )
  )
);
create policy "customers read own invoice payments" on invoice_payments for select using (
  exists (select 1 from invoices i where i.id = invoice_id and i.customer_id = auth.uid())
);

-- ── Attachments (work order, PO, agreement, supporting docs) — files
-- live in the "invoice-attachments" Storage bucket (create it manually
-- in the Supabase dashboard, same as the existing "employee-documents"
-- bucket — private, not public).
create table invoice_attachments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  file_name text not null,
  file_path text not null,
  uploaded_by uuid references profiles (id),
  uploaded_at timestamptz not null default now()
);
create index invoice_attachments_invoice_id_idx on invoice_attachments (invoice_id);
alter table invoice_attachments enable row level security;
