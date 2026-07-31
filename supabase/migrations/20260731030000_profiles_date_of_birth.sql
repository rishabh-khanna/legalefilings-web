-- For the birthday-email scheduler — covers customers and staff/admin
-- alike, since it's one shared profiles table.
alter table profiles add column date_of_birth date;
