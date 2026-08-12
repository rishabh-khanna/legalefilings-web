-- leads and orders never recorded who created the row — assigned_to
-- tracks who currently owns it, but a lead/order can be reassigned, at
-- which point the original creator is lost. Existing rows backfill to
-- null (unknowable, same honest-default approach as
-- 20260828000000_audit_columns.sql) rather than a guessed value; going
-- forward the API sets it at insert time.

alter table leads add column created_by uuid references profiles (id);
alter table orders add column created_by uuid references profiles (id);
