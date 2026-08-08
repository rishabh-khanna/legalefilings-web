-- ═══════════════════════════════════════════════════════════════════════
-- ORDER DOCUMENT COLLECTION
-- ═══════════════════════════════════════════════════════════════════════
-- A customer buying a plan (company registration, GST, etc.) almost
-- always needs to hand over supporting documents (PAN, Aadhaar, address
-- proof...) before the filing can actually happen. This gives every
-- order a document_status independent of its main pipeline status (a
-- separate axis, not a new order_status value — an order can be
-- "in_progress" on the filing while still "awaiting" documents, and
-- conflating the two into one enum would make every existing
-- status-based branch in the app ambiguous), plus a real place to
-- upload and review the actual files.

create type order_document_status as enum ('awaiting', 'submitted', 'verified', 'not_required');

-- Most of this business's services genuinely need KYC-style documents,
-- so new orders default to "awaiting" rather than assuming none are
-- needed — staff can flip a specific order to 'not_required' when that
-- particular engagement doesn't need any.
alter table orders add column document_status order_document_status not null default 'awaiting';

create table order_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  organization_id uuid not null references organizations (id),
  file_name text not null,
  file_path text not null,
  file_size bigint,
  uploaded_by uuid references profiles (id),
  -- Per-document review, not just a holistic order-level status — staff
  -- needs to be able to reject one blurry photo without losing the rest
  -- of an otherwise-complete submission.
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  review_note text,
  created_at timestamptz not null default now()
);
create index order_documents_order_id_idx on order_documents (order_id);
create index order_documents_organization_id_idx on order_documents (organization_id);

-- Service-role only (API-layer enforcement, same pattern as
-- employee_documents/invoice_attachments) — RLS enabled with zero
-- policies means default-deny for any direct browser-session query.
alter table order_documents enable row level security;

-- ═══════════════════════════════════════════════════════════════════════
-- MANUAL STEP — create the storage bucket yourself (same as
-- "employee-documents" and "invoice-attachments" before it, per those
-- migrations' own notes — buckets aren't created via SQL migrations in
-- this project):
--
--   Supabase Dashboard → Storage → New bucket → name: "order-documents",
--   Public: OFF (private — downloads are always served through a
--   signed URL from the API, never a public path).
-- ═══════════════════════════════════════════════════════════════════════
