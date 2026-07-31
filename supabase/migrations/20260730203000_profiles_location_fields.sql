-- City/state so the existing Edit Profile form (already built with
-- StateSelect/CitySelect) can persist to a real column.
alter table profiles add column city text;
alter table profiles add column state text;
