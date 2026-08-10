-- Anchor day for recurring invoice templates.
--
-- nextRunAfter advanced a monthly template with setMonth(+1), which
-- rolls over rather than clamping: a template billing on the 31st went
-- 31 Jan -> 3 Mar. That skipped February's invoice entirely and then
-- locked the series onto the 3rd forever. Any billing day past the 28th
-- was affected.
--
-- The finance module already solved this for recurring expenses — it
-- stores day_of_month and anchors every advance to it. Recurring
-- invoices had no equivalent, so this brings them in line.
--
-- Backfilled from the current next_run_date, which is the best available
-- evidence of the day the series was meant to bill on.
alter table recurring_invoice_templates
  add column anchor_day smallint;

update recurring_invoice_templates
set anchor_day = extract(day from next_run_date)::smallint
where anchor_day is null;

alter table recurring_invoice_templates
  add constraint recurring_anchor_day_valid
  check (anchor_day is null or (anchor_day between 1 and 31));
