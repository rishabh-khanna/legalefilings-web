-- Closes a double-submit race on POST /api/crm-access-requests: two
-- concurrent submits both pass the "existing pending request?" SELECT
-- before either INSERT lands, producing two pending rows for the same
-- customer. A partial unique index (one row per requested_by while
-- status = 'pending') makes the second INSERT fail instead, which the
-- route now treats the same as the pre-existing 409 check.
create unique index org_access_requests_one_pending_per_user
  on org_access_requests (requested_by)
  where status = 'pending';
