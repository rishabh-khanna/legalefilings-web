-- 20260822000000_atomic_attendance_clock.sql declared p_event_type as
-- plain `text`, then compared/inserted it against attendance_events.
-- event_type, which is the attendance_event_type enum — Postgres raises
-- "column \"event_type\" is of type attendance_event_type but expression
-- is of type text" (SQLSTATE 42804) rather than silently casting,
-- because an implicit text->enum cast isn't defined for a PL/pgSQL
-- variable/parameter (only for text literals). Every call to this RPC
-- has been failing with a 500 since that migration landed. Re-declaring
-- the parameter as the enum type itself (not casting at each use site)
-- both fixes the bug and keeps the 'check_in'/'check_out' validation the
-- function already does meaningful, since an invalid string can no
-- longer reach this function at all — Postgres rejects it before the
-- function body ever runs.
create or replace function record_attendance_event(
  p_staff_id uuid,
  p_organization_id uuid,
  p_event_type attendance_event_type,
  p_location text
) returns attendance_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today_start timestamptz;
  v_last_event_type attendance_event_type;
  v_result attendance_events;
begin
  perform pg_advisory_xact_lock(hashtext(p_staff_id::text));

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
