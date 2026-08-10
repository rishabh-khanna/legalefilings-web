-- Payment reminders (dunning) for unpaid invoices.
--
-- A daily cron already flipped overdue invoices to 'overdue' and wrote a
-- history entry, but nothing ever told the customer. The status was pure
-- internal bookkeeping: nobody chased the money unless a human happened
-- to notice a badge, which is the one job accounts-receivable software
-- exists to do.
--
-- The unique (invoice_id, kind) constraint is the idempotency mechanism,
-- not just a data-integrity nicety. The cron claims a reminder by
-- INSERTing this row *before* sending the email; a duplicate insert
-- fails with 23505 and that send is skipped. Without it, a retried or
-- overlapping cron run would email the same customer about the same
-- invoice twice — the kind of bug that erodes trust faster than the late
-- payment it was chasing.
create table invoice_reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices (id) on delete cascade,
  -- 'due_soon' | 'overdue_1' | 'overdue_7' | 'overdue_14' | 'overdue_30'
  kind text not null,
  sent_at timestamptz not null default now(),
  unique (invoice_id, kind)
);

create index invoice_reminders_invoice_id_idx on invoice_reminders (invoice_id);

alter table invoice_reminders enable row level security;
create policy "staff read invoice reminders" on invoice_reminders for select using (is_staff_or_admin());

-- Surfaces reminders in the existing per-invoice history timeline, so
-- "did we actually chase this?" is answerable from the invoice itself
-- rather than only from the reminders table.
alter type invoice_event_type add value if not exists 'reminder_sent';
