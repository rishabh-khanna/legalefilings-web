-- "individuals update own profile" (init migration) allows a signed-in
-- user to update ANY column on their own row — RLS only checks row
-- ownership, not which columns changed. That's fine for full_name/phone/
-- bank details/etc., but it also technically let an employee grant
-- themselves a different department, designation, UAN/ESIC number, staff
-- level, or even account_type via a direct API call, bypassing whatever
-- the UI does or doesn't expose. This trigger enforces the boundary at
-- the data layer: those columns can only change through a service-role
-- connection (our admin API routes), never through a user's own session.
create or replace function prevent_self_privilege_update()
returns trigger as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.account_type is distinct from old.account_type
     or new.customer_tier is distinct from old.customer_tier
     or new.staff_level is distinct from old.staff_level
     or new.reports_to is distinct from old.reports_to
     or new.employee_id is distinct from old.employee_id
     or new.department is distinct from old.department
     or new.designation is distinct from old.designation
     or new.date_of_joining is distinct from old.date_of_joining
     or new.uan_number is distinct from old.uan_number
     or new.esic_number is distinct from old.esic_number
     or new.crm_status is distinct from old.crm_status
  then
    raise exception 'Only an admin can change this field';
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger profiles_prevent_self_privilege_update
  before update on profiles
  for each row execute function prevent_self_privilege_update();
