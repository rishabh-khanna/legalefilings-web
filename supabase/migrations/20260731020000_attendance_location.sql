-- Captures where a clock in/out happened (browser geolocation, lat,lng as
-- text — no external geocoding API, just stored coordinates the UI links
-- out to a map with).
alter table attendance_events add column location text;
