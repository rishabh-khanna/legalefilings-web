-- The old /api/attendance POST path did a SELECT (last event today) then
-- a separate INSERT from the API route, with no atomicity between them —
-- the same class of race the invoice_payments unique constraint closed
-- for payments (20260821000000). Two near-simultaneous clock-in requests
-- (a double-click, or two browser tabs open to the same account) could
-- both read "not clocked in yet" before either had inserted, producing
-- two check_in events for the same person on the same day.
--
-- A plain unique constraint can't express the rule here the way it could
-- for invoice_payments: attendance legitimately has multiple check_in/
-- check_out *pairs* per day (lunch breaks, etc.) — what's invalid is two
-- check_ins (or two check_outs) in a row with nothing of the opposite
-- type in between, which only a stateful check can catch. Doing the
-- check-then-insert as one atomic database function (advisory lock +
-- read + insert, all in the same transaction) closes the race properly,
-- instead of just narrowing the window.
create or replace function record_attendance_event(
  p_staff_id uuid,
  p_organization_id uuid,
  p_event_type text,
  p_location text
) returns attendance_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today_start timestamptz;
  v_last_event_type text;
  v_result attendance_events;
begin
  if p_event_type not in ('check_in', 'check_out') then
    raise exception 'invalid_event_type';
  end if;

  -- Serializes concurrent calls for the *same* staff member only (the
  -- hash is per-staff-id) — doesn't block other people's clock-ins/outs
  -- from proceeding concurrently, just this one person's two racing
  -- requests. Released automatically at transaction end.
  perform pg_advisory_xact_lock(hashtext(p_staff_id::text));

  -- Same fixed +5:30, no-DST IST day boundary as src/lib/ist-date.ts's
  -- startOfTodayIST() — India has one timezone, and Asia/Kolkata in
  -- Postgres already has no DST transitions to worry about either.
  v_today_start := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';

  select event_type into v_last_event_type
  from attendance_events
  where staff_id = p_staff_id and occurred_at >= v_today_start
  order by occurred_at desc
  limit 1;

  if p_event_type = 'check_in' and v_last_event_type = 'check_in' then
    raise exception 'already_clocked_in';
  end if;
  if p_event_type = 'check_out' and (v_last_event_type is null or v_last_event_type = 'check_out') then
    raise exception 'not_clocked_in';
  end if;

  insert into attendance_events (organization_id, staff_id, event_type, location)
  values (p_organization_id, p_staff_id, p_event_type, p_location)
  returning * into v_result;

  return v_result;
end;
$$;
