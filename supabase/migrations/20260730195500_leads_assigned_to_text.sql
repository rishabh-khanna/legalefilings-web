-- leads.assigned_to was a uuid FK to profiles, but there's no real staff
-- login/account system yet — the CRM board currently assigns leads by
-- plain staff name (see MOCK_STAFF in src/lib/leads.ts). Relax it to text
-- for now; once real staff accounts exist this can go back to a profiles
-- FK (and existing values migrated by matching name -> profile).
drop index if exists leads_assigned_to_idx;
alter table leads drop constraint if exists leads_assigned_to_fkey;
alter table leads alter column assigned_to type text using assigned_to::text;
create index leads_assigned_to_idx on leads (assigned_to);
