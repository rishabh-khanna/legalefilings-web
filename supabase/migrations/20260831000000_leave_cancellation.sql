-- Leave cancellation / withdrawal.
--
-- There was no way to cancel a leave request — no route, no status, for
-- either the employee or the approver. Once submitted a request was
-- permanent, and once approved its days were permanently consumed. The
-- only recovery was an admin editing rows by hand, and plans change
-- often enough that this came up constantly.
--
-- 'cancelled' is a distinct status from 'rejected' on purpose: rejected
-- is the approver declining, cancelled is the request being withdrawn.
-- Conflating them would make the leave history lie about what happened.
alter type request_status add value if not exists 'cancelled';

-- increment_leave_balance_used is now also the *decrement* path — a
-- cancelled approval hands back the days it consumed by passing a
-- negative p_days.
--
-- Both branches clamp at zero. Balance used should never be able to go
-- negative: that would silently hand an employee extra entitlement, and
-- it would be caused by exactly the kind of double-cancel or
-- out-of-order retry this function is supposed to absorb. Clamping keeps
-- a bug contained to "no change" rather than "free leave days".
--
-- The update branch adds p_days directly rather than excluded.used:
-- excluded holds the *clamped* insert value, which is 0 for any negative
-- p_days, so using it here would make every decrement a silent no-op.
create or replace function increment_leave_balance_used(
  p_staff_id uuid,
  p_leave_type_id uuid,
  p_organization_id uuid,
  p_year integer,
  p_days numeric,
  p_carried_forward numeric
) returns void as $$
  insert into leave_balances (staff_id, leave_type_id, organization_id, year, carried_forward, used)
  values (p_staff_id, p_leave_type_id, p_organization_id, p_year, p_carried_forward, greatest(0, p_days))
  on conflict (staff_id, leave_type_id, year)
  do update set used = greatest(0, leave_balances.used + p_days);
$$ language sql security definer set search_path = public;
