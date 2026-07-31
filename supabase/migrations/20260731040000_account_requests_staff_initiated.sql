-- Extends account_requests beyond public self-signup (a person requesting
-- their own staff account) to also cover a staff member requesting a new
-- account be created on someone else's behalf (a customer or another
-- staff member). requested_by is null for the original self-signup case
-- (no account exists yet to attribute it to) and set to the submitting
-- staff member's profile id otherwise. The extra fields mirror
-- CreateUserInput so an approved request has everything
-- createUserWithProfile needs, regardless of which flow created the row.
alter table account_requests add column requested_by uuid references profiles (id);
alter table account_requests add column requested_customer_tier customer_tier;
alter table account_requests add column company text;
alter table account_requests add column city text;
alter table account_requests add column state text;
