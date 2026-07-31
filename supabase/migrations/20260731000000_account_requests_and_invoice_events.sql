-- Account requests: self-service signup for non-customer roles (staff),
-- gated by admin approval. A rejected request can be edited and
-- resubmitted (status reset to 'pending', review_note cleared) rather
-- than creating a new row each time, so there's one row per person's
-- request history-in-progress.
create type account_request_status as enum ('pending', 'approved', 'rejected');

create table account_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  requested_account_type account_type not null default 'staff',
  requested_staff_level staff_level,
  message text,
  status account_request_status not null default 'pending',
  reviewed_by uuid references profiles (id),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger account_requests_set_updated_at before update on account_requests
  for each row execute function set_updated_at();

create index account_requests_status_idx on account_requests (status);
create index account_requests_email_idx on account_requests (email);

-- All access to this table goes through API routes using the secret key
-- (public submission + status-check by email must not require a login
-- session, and must not be reachable by direct anon-key RLS queries that
-- could enumerate other people's requests) — RLS is enabled with no
-- client-facing policies, matching the `leads` table's pattern.
alter table account_requests enable row level security;

-- Invoice audit trail — "who created / downloaded what, and when."
create type invoice_event_type as enum ('created', 'downloaded', 'sent', 'status_changed');

create table invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  event_type invoice_event_type not null,
  actor_id uuid references profiles (id),
  detail text,
  created_at timestamptz not null default now()
);

create index invoice_events_invoice_id_idx on invoice_events (invoice_id);

alter table invoice_events enable row level security;
create policy "staff read invoice events" on invoice_events for select using (is_staff_or_admin());
create policy "customers read own invoice events" on invoice_events for select using (
  exists (select 1 from invoices i where i.id = invoice_id and i.customer_id = auth.uid())
);

-- Quick/ad hoc invoices (an admin typing in a few line items on the spot)
-- aren't always tied to a formal order — relax the FK to optional.
alter table invoices alter column order_id drop not null;
