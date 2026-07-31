-- Many enquiries are on behalf of a business — needed so the dashboard's
-- CRM view (a staff member's assigned leads) can show a company column
-- like the old mock version did, without inventing a second contacts table.
alter table leads add column company text;
