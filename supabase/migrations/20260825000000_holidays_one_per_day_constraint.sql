-- Closes a duplicate-holiday bug: nothing stopped an org from ending up
-- with multiple holiday entries on the same calendar date (seen live as
-- "Alpha Foundation Day" appearing 3 times for the same date) — no DB
-- constraint, and the Add Holiday form has no protection beyond
-- disabling the submit button while in flight. One holiday per
-- organization per date is the correct rule (a date is either a holiday
-- or it isn't; two differently-named holidays on the same day is not a
-- real scenario this app needs to support).

-- Clean up existing duplicates first — for each (organization_id, date),
-- keep the oldest row and delete the rest, or the unique index below
-- would fail to create.
delete from holidays a using holidays b
where a.organization_id = b.organization_id
  and a.date = b.date
  and a.created_at > b.created_at;
-- Tie-break on id for any rows inserted at the exact same created_at.
delete from holidays a using holidays b
where a.organization_id = b.organization_id
  and a.date = b.date
  and a.created_at = b.created_at
  and a.id > b.id;

create unique index holidays_org_date_idx on holidays (organization_id, date);
