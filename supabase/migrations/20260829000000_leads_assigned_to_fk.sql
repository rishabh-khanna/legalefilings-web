-- leads.assigned_to back to a real profiles FK.
--
-- 20260730195500 relaxed this column from a uuid FK to plain text
-- because "there's no real staff login/account system yet" — its own
-- comment said to revert "once real staff accounts exist (and existing
-- values migrated by matching name -> profile)." Real staff accounts,
-- departments, and a reporting chain have existed for a while now; this
-- is that revert.
--
-- Storing the assignee as a display name caused four live bugs:
--
--  1. Unclaimed leads were invisible to the people meant to claim them.
--     Access scoping is `assigned_to IN (visible names)`, and Postgres
--     IN never matches NULL — which is what an unclaimed lead actually
--     holds. Only admins (who skip the filter) could see the shared
--     pool, so "claim a lead" was dead for every rater/leader.
--  2. Two representations of the same state. The claim path matches
--     NULL; /api/admin/create-user matched the literal string
--     'Unassigned'. Both exist in the data, so a lead written by one
--     path was unreachable by the other.
--  3. Renaming a staff member orphaned their whole pipeline — anyone
--     can edit their own full_name on /dashboard/profile, and nothing
--     rewrote the leads they owned.
--  4. Two staff sharing a name in one org would see each other's leads,
--     since scoping compared strings.
--
-- Backfill matches name -> profile *within the same organization*, so a
-- name reused across tenants (common here: 'Alpha Admin' exists in 30
-- orgs) can't cross-link. Verified before writing this: no organization
-- currently has two staff sharing a full_name, so every match is
-- unambiguous. Anything that doesn't resolve (the literal 'Unassigned',
-- or a name with no matching profile) lands as NULL — genuinely
-- unassigned, which is now the single unambiguous representation.

-- The constraint is named explicitly rather than left to Postgres:
-- an auto-named one would come out as leads_assigned_to_id_fkey (after
-- the staging column), and renaming a column does NOT rename its
-- constraint — so the FK would keep the wrong name and the PostgREST
-- embed the API relies on (profiles!leads_assigned_to_fkey) wouldn't
-- resolve.
alter table leads add column assigned_to_id uuid;
alter table leads add constraint leads_assigned_to_fkey
  foreign key (assigned_to_id) references profiles (id);

update leads l
set assigned_to_id = p.id
from profiles p
where p.full_name = l.assigned_to
  and p.organization_id = l.organization_id
  and p.account_type in ('staff', 'admin')
  and l.assigned_to is not null
  and l.assigned_to <> 'Unassigned';

drop index if exists leads_assigned_to_idx;
alter table leads drop column assigned_to;
alter table leads rename column assigned_to_id to assigned_to;
create index leads_assigned_to_idx on leads (assigned_to);
