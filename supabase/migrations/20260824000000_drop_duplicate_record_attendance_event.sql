-- 20260823000000 used `create or replace function` to fix the enum-cast
-- bug in record_attendance_event, but changing a parameter's TYPE (text
-- -> attendance_event_type) isn't something Postgres treats as replacing
-- the same function — it created a second, differently-typed overload
-- instead of replacing the original. PostgREST then couldn't tell the
-- two apart ("Could not choose the best candidate function... try
-- renaming the parameters"), so every call started failing again, just
-- with a different error. Drop the original text-typed signature
-- explicitly so only the corrected enum-typed version remains.
drop function if exists record_attendance_event(uuid, uuid, text, text);
