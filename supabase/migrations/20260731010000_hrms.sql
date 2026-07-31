-- HRMS: attendance (explicit clock in/out — not tied to browser login
-- session, since staying logged into the site isn't the same as working),
-- leave requests, and attendance-correction requests (for a missed punch),
-- each with an admin approval workflow matching the account_requests
-- pattern already established.

create type attendance_event_type as enum ('check_in', 'check_out');

create table attendance_events (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id),
  event_type attendance_event_type not null,
  occurred_at timestamptz not null default now(),
  note text
);

create index attendance_events_staff_id_idx on attendance_events (staff_id);
create index attendance_events_occurred_at_idx on attendance_events (occurred_at);

alter table attendance_events enable row level security;
create policy "staff read own attendance" on attendance_events for select using (auth.uid() = staff_id);
create policy "staff insert own attendance" on attendance_events for insert with check (auth.uid() = staff_id);
create policy "admins read all attendance" on attendance_events for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
);

create type leave_type as enum ('sick', 'casual', 'paid', 'unpaid');
create type request_status as enum ('pending', 'approved', 'rejected');

create table leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id),
  leave_type leave_type not null,
  start_date date not null,
  end_date date not null,
  reason text,
  status request_status not null default 'pending',
  reviewed_by uuid references profiles (id),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_dates_valid check (end_date >= start_date)
);

create trigger leave_requests_set_updated_at before update on leave_requests
  for each row execute function set_updated_at();
create index leave_requests_staff_id_idx on leave_requests (staff_id);
create index leave_requests_status_idx on leave_requests (status);

alter table leave_requests enable row level security;
create policy "staff read own leave requests" on leave_requests for select using (auth.uid() = staff_id);
create policy "staff insert own leave requests" on leave_requests for insert with check (auth.uid() = staff_id);
create policy "admins read all leave requests" on leave_requests for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
);
create policy "admins update leave requests" on leave_requests for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
);

-- Attendance-correction requests: "I forgot to clock in/out on this day" —
-- staff proposes the correct times, admin approves or rejects with a
-- reason. Approving inserts the corresponding attendance_events rows
-- (marked with note = 'regularized').
create table attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references profiles (id),
  date date not null,
  requested_check_in time,
  requested_check_out time,
  reason text not null,
  status request_status not null default 'pending',
  reviewed_by uuid references profiles (id),
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger attendance_corrections_set_updated_at before update on attendance_corrections
  for each row execute function set_updated_at();
create index attendance_corrections_staff_id_idx on attendance_corrections (staff_id);
create index attendance_corrections_status_idx on attendance_corrections (status);

alter table attendance_corrections enable row level security;
create policy "staff read own corrections" on attendance_corrections for select using (auth.uid() = staff_id);
create policy "staff insert own corrections" on attendance_corrections for insert with check (auth.uid() = staff_id);
create policy "admins read all corrections" on attendance_corrections for select using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
);
create policy "admins update corrections" on attendance_corrections for update using (
  exists (select 1 from profiles p where p.id = auth.uid() and p.account_type = 'admin')
);
