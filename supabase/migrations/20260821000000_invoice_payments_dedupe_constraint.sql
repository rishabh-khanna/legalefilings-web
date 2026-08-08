-- /api/payments/verify (fired by the browser right after Razorpay
-- Checkout succeeds) and /api/payments/webhook (Razorpay's own durable
-- callback) can both fire for the same captured payment within
-- milliseconds of each other — that's the documented, expected overlap
-- between the two paths, not a rare edge case. Both routes (and
-- create-order's own catch-up loop) only guarded against double-recording
-- with a SELECT-then-INSERT check in application code, which is a classic
-- TOCTOU race: both requests can read "not yet recorded" before either
-- one writes, producing two invoice_payments rows for one real payment
-- and inflating the recorded total paid on that invoice.
--
-- Postgres treats NULL <> NULL for uniqueness purposes, so this only
-- constrains rows that actually have a transaction_id (Razorpay
-- payments) — manually recorded payments (staff "Record Payment", cash,
-- cheque, etc.) leave transaction_id null and are unaffected.
alter table invoice_payments
  add constraint invoice_payments_invoice_transaction_unique
  unique (invoice_id, transaction_id);
