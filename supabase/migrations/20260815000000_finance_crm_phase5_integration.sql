-- ═══════════════════════════════════════════════════════════════════════
-- BUSINESS FINANCE CRM, PHASE 5: INVOICING INTEGRATION + TDS
-- ═══════════════════════════════════════════════════════════════════════
-- Two real connections back to the rest of this app, not a rebuild of
-- either system:
--   1. An invoice this customer already paid Legal Efilings/a tenant org
--      for (professional fees, filings, etc.) is a real business expense
--      of theirs — linked_invoice_id lets it be imported as one instead
--      of re-typed by hand, and stops it from being imported twice.
--   2. TDS (tax deducted at source on payments to vendors — professional
--      fees, rent, commission... several of which are already default
--      expense categories) needed its own fields; nothing existing
--      modeled it.

alter table expense_transactions add column linked_invoice_id uuid references invoices (id);
create unique index expense_transactions_linked_invoice_id_idx on expense_transactions (linked_invoice_id) where linked_invoice_id is not null;

alter table expense_transactions add column tds_applicable boolean not null default false;
alter table expense_transactions add column tds_section text;
alter table expense_transactions add column tds_rate numeric(5, 2);
alter table expense_transactions add column tds_amount numeric(12, 2);
