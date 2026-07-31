-- Align lead_status enum values with the stage names the /admin CRM board
-- (src/lib/leads.ts LEAD_STAGES) already shipped with, instead of changing
-- the frontend to match the DB.
alter type lead_status rename value 'qualified' to 'in_progress';
alter type lead_status rename value 'converted' to 'won';
