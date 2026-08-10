-- Department and Designation are already mandatory on both routes that
-- create a staff/admin account (the direct "Create User" form and the
-- self-service "Request New User" form both block submit without them)
-- but account_requests had nowhere to put them — the request-user API
-- route silently dropped both fields on the floor, so anyone onboarded
-- through the request/approve queue (as opposed to direct creation)
-- ended up with a real account and no department/designation at all,
-- with no record either request or reviewer ever saw them.
alter table account_requests add column department text;
alter table account_requests add column designation text;
