-- Razorpay integration: invoices gain gateway-tracking columns so an
-- online payment can be tied back to the Razorpay order/payment it came
-- from, and re-verified/reconciled later (webhook, support disputes).
alter table invoices
  add column razorpay_order_id text,
  add column razorpay_payment_id text,
  add column payment_method text not null default 'manual';

create unique index invoices_razorpay_order_id_idx on invoices (razorpay_order_id) where razorpay_order_id is not null;
create unique index invoices_razorpay_payment_id_idx on invoices (razorpay_payment_id) where razorpay_payment_id is not null;
