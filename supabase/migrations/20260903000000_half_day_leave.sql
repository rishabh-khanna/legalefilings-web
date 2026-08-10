-- Half-day leave.
--
-- Every leave request was a whole number of days, so a half-day casual
-- leave — completely standard practice in an Indian office — had to be
-- taken as a full day or not recorded at all. Neither leaves the balance
-- or the attendance record accurate.
--
-- Stored as a fraction rather than a boolean so the balance arithmetic
-- stays one multiplication (working days x fraction) and a future
-- quarter-day or hourly policy doesn't need another schema change.
--
-- Constrained to a single-day range: "half day" on a Monday-to-Friday
-- request is ambiguous (half of each day? half the week?), and every
-- real half-day policy means one specific day. Enforced in the database
-- rather than only in the API so the rule can't be bypassed.
alter table leave_requests
  add column day_fraction numeric(3, 2) not null default 1.0;

alter table leave_requests
  add constraint leave_day_fraction_valid
  check (day_fraction in (0.5, 1.0));

alter table leave_requests
  add constraint leave_half_day_single_date
  check (day_fraction = 1.0 or start_date = end_date);

-- Which half, for the attendance record and the approver's context.
-- Null for a full day.
alter table leave_requests
  add column half_day_period text
  check (half_day_period is null or half_day_period in ('first_half', 'second_half'));
