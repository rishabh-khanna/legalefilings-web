-- Needed to scope invoice visibility to "whoever created it" (+ their
-- reporting chain) instead of every staff member seeing every invoice
-- company-wide, same as leads/orders/attendance.
alter table invoices add column created_by uuid references profiles (id);
