-- Atomic bank/cash balance updates for Business Finance.
--
-- applyExpenseBalanceEffect did a read-then-write: SELECT current_balance,
-- then UPDATE to (read value + delta). Two approved transactions hitting
-- the same account close together lose one of them outright —
--
--   T1 reads 1000 · T2 reads 1000 · T1 writes 1100 · T2 writes 1200
--
-- and T1's ₹100 is gone from the ledger with nothing to indicate it ever
-- happened. A bookkeeping tool silently losing money is the worst
-- failure mode this module has.
--
-- Its comment justified the pattern as matching "the level of rigor
-- everywhere else in this app", which was true when written and no
-- longer is: record_attendance_event (attendance punches),
-- increment_leave_balance_used (leave days), and next_invoice_number
-- (invoice serials) are all atomic now. The actual money balance was the
-- last read-then-write left, which is exactly backwards.
--
-- A single UPDATE ... SET col = col + delta takes a row lock and is
-- atomic on its own — no advisory lock or transaction block needed.

create or replace function apply_expense_account_delta(
  p_account_id uuid,
  p_delta numeric
) returns void as $$
  update expense_accounts
  set current_balance = current_balance + p_delta
  where id = p_account_id;
$$ language sql security definer set search_path = public;

create or replace function apply_expense_cash_delta(
  p_customer_id uuid,
  p_delta numeric
) returns void as $$
  update expense_business_profiles
  set cash_balance = cash_balance + p_delta
  where customer_id = p_customer_id;
$$ language sql security definer set search_path = public;
