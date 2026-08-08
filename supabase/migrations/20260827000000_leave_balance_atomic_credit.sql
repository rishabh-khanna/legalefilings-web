-- Closes a lost-update race in leave balance crediting: the API route
-- was doing read-current-used, then write-used-plus-days as two separate
-- statements. Two leave requests for the same staff/leave_type/year
-- approved concurrently (by two different managers, or two admin clicks
-- in quick succession) could both read the same starting `used` value
-- and each write back their own total, silently dropping one of the two
-- increments. A single atomic UPDATE (or INSERT ... ON CONFLICT) has no
-- such window — Postgres serializes concurrent writers on the same row.
create or replace function increment_leave_balance_used(
  p_staff_id uuid,
  p_leave_type_id uuid,
  p_organization_id uuid,
  p_year integer,
  p_days numeric,
  p_carried_forward numeric
) returns void as $$
  insert into leave_balances (staff_id, leave_type_id, organization_id, year, carried_forward, used)
  values (p_staff_id, p_leave_type_id, p_organization_id, p_year, p_carried_forward, p_days)
  on conflict (staff_id, leave_type_id, year)
  do update set used = leave_balances.used + excluded.used;
$$ language sql security definer set search_path = public;
