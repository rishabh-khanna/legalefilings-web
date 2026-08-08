-- ═══════════════════════════════════════════════════════════════════════
-- EMAIL FAILURE LOG
-- ═══════════════════════════════════════════════════════════════════════
-- Every transactional email in this app (account-created password,
-- payment confirmation, payment request, bill reminder) was wrapped in
-- try/catch that just console.error'd on failure and moved on — if
-- Brevo's SMTP is ever down or misconfigured, a customer's account gets
-- created with no password email, or a payment confirmation just never
-- arrives, with zero visibility for anyone and no way to know it
-- happened short of combing through server logs. This gives admins a
-- real place to see what failed and follow up manually — not a retry
-- queue (that's a bigger investment than this app needs right now), just
-- visibility instead of silence.
create table email_failures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations (id),
  email_type text not null,
  recipient_email text not null,
  -- Free-text pointer to whatever the email was about (e.g.
  -- "invoice:<uuid>", "profile:<uuid>") — deliberately not a foreign key
  -- to any one table, since different email types relate to different
  -- entities and this is only ever read by a human, not joined on.
  related_entity text,
  error_message text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index email_failures_org_id_idx on email_failures (organization_id);
create index email_failures_resolved_idx on email_failures (resolved);

-- Service-role only (API-layer enforcement, same pattern as every other
-- table in this app) — RLS enabled with zero policies means default-deny
-- for any direct browser-session query.
alter table email_failures enable row level security;
