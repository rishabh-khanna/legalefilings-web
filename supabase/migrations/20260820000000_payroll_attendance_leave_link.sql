-- ═══════════════════════════════════════════════════════════════════════
-- PAYROLL ↔ ATTENDANCE/LEAVE LINK (Loss of Pay)
-- ═══════════════════════════════════════════════════════════════════════
-- calculatePayroll (src/lib/payroll.ts) previously computed a payslip
-- purely from the fixed salary structure — an employee on 10 days
-- unapproved absence and one who worked the full month got an identical
-- payslip. This adds a Loss of Pay (LOP) deduction driven by real
-- attendance_events/leave_requests data: any working weekday with
-- neither a check-in nor approved paid leave counts against LOP,
-- deducted at gross-salary/days-in-month per day — the standard
-- simplified formula, matching this module's existing "documented
-- defaults, not a full compliance engine" approach (see payroll.ts's own
-- comment on PF/ESI/PT).
alter table payslips add column lop_days numeric(5, 2) not null default 0;
alter table payslips add column lop_deduction numeric(12, 2) not null default 0;
