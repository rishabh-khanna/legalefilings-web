// The dashboard's own "manual" — one entry per page, used by two features:
// 1. The small "?" info button next to every DashboardPageHero (looked up
//    by the current route), which shows `summary`/`details`/`access` for
//    that page.
// 2. The dashboard Help Assistant (bottom-right chat widget), which
//    keyword-matches a typed question against every entry below and
//    answers from `details` + `access` with a link to the right page.
//
// IMPORTANT — keep this in sync with the product: whenever a dashboard
// page is added, renamed, or its purpose or role-scoping changes,
// add/update its entry here in the same change. This file is the single
// source of truth for both features; nothing else needs editing to teach
// either of them about a page (DashboardPageHero and the assistant both
// read from this file automatically, keyed by path).
export type ManualEntry = {
  // Matched by exact-or-prefix against the current pathname — lookup
  // picks the longest matching path, so a more specific route (e.g.
  // /dashboard/finance/recurring) correctly wins over a shorter parent
  // route (/dashboard/finance) that would otherwise also match.
  path: string;
  title: string;
  // One sentence — shown in the page-header tooltip.
  summary: string;
  // A fuller paragraph — what the Help Assistant answers with when this
  // page is the best match for a typed question.
  details: string;
  // Who can see this page at all, and what data each role actually sees
  // once there (e.g. "your own only" vs "your team" vs "the whole org").
  // Always shown, in both the tooltip and the assistant's answer — this
  // is the single most-asked "wait, why do I see different things than
  // them" question, so it's never optional or buried.
  access: string;
  // Extra terms (role names, synonyms) to help the assistant match
  // phrasing that doesn't literally appear in the title/summary/details.
  keywords?: string[];
};

export const DASHBOARD_MANUAL: ManualEntry[] = [
  {
    path: "/dashboard/finance/recurring",
    title: "Recurring Expenses",
    summary: "Templates for expenses or income that repeat every month.",
    details:
      "Recurring Expenses holds templates for entries that repeat every month — rent, salaries, subscriptions, insurance. Set one up once (amount, category, payment mode, day of month) and it posts automatically going forward; you can pause or delete a template any time.",
    access:
      "Scoped to one set of Business Finance books (not your staff role) — Owner/Admin on that book can create, pause, or delete templates; Accountant/Employee/Viewer can only view the schedule.",
    keywords: ["automatic", "monthly", "subscription", "rent", "template"],
  },
  {
    path: "/dashboard/finance/reports",
    title: "Business Finance Reports",
    summary: "Every Business Finance report, exportable as PDF or CSV.",
    details:
      "This is every report over your recorded income and expenses — Day Book, Ledger, Cash Book, category/vendor/bank-wise expense breakdowns, GST purchase register, GST summary, TDS report, Profit & Loss, and a cash-and-bank Balance Sheet. Pick a date range (presets or custom), search within it, and export as PDF or CSV.",
    access:
      "Scoped to one set of Business Finance books — anyone with access to that book (Viewer and up) can run and export every report; there's no report restricted to just Owner/Admin.",
    keywords: ["export", "csv", "pdf", "profit and loss", "balance sheet", "gst", "tds"],
  },
  {
    path: "/dashboard/finance/team",
    title: "Business Finance — Team",
    summary: "Who has access to these books and what they can do.",
    details:
      "Manages who can see or edit this set of Business Finance books, and their role: Owner/Admin (full control), Accountant or Employee (can record entries), Viewer (read-only). This is a separate permission system from your normal staff role — it only controls access to these specific books.",
    access:
      "Only reachable at all if you have manage_users on the active book (Owner or Admin) — everyone else never sees the \"Team\" link. Shows every person with access to this one book and their book-specific role, unrelated to account_type/staff_level.",
    keywords: ["access", "permission", "role", "owner", "accountant", "viewer"],
  },
  {
    path: "/dashboard/finance/budgets",
    title: "Budgets",
    summary: "Set monthly spending limits per category and track against them.",
    details:
      "Set a monthly budget for a spending category and see actual spend tracked against it as expenses come in, so you notice before you're over rather than after.",
    access: "Scoped to one set of Business Finance books — Owner/Admin set budgets; every book member can view them.",
    keywords: ["limit", "spending", "category"],
  },
  {
    path: "/dashboard/finance/activity",
    title: "Business Finance — Activity",
    summary: "Audit trail of every change made in these books.",
    details:
      "A running log of every change made in this set of Business Finance books — who added, edited, or deleted an entry, and when.",
    access: "Scoped to one set of Business Finance books — visible to anyone with access to that book, same as the reports.",
    keywords: ["audit", "log", "history", "who changed"],
  },
  {
    path: "/dashboard/finance/import",
    title: "Import Transactions",
    summary: "Bring in transactions from a bank statement or CSV.",
    details:
      "Import income/expense entries in bulk from a bank statement or CSV instead of typing each one in by hand.",
    access: "Scoped to one set of Business Finance books — requires the same entry-recording permission (Accountant/Employee/Owner/Admin) as adding a transaction by hand; Viewer can't import.",
    keywords: ["csv", "bank statement", "bulk"],
  },
  {
    path: "/dashboard/finance/settings",
    title: "Business Finance — Settings",
    summary: "Settings for this set of Business Finance books.",
    details:
      "Business Finance-specific settings for this set of books — currency, approval rules for expenses, and similar options. This is separate from the company-wide Business Settings page.",
    access: "Scoped to one set of Business Finance books — Owner/Admin only.",
    keywords: ["currency", "approval", "config"],
  },
  {
    path: "/dashboard/finance",
    title: "Business Finance",
    summary: "Internal bookkeeping — bank/cash accounts, income & expenses, reports.",
    details:
      "Business Finance is internal bookkeeping for a customer or organization — bank and cash accounts, income/expense entries with categories, recurring templates, and reports. It's for keeping your own books straight, not a substitute for actually filing GST/TDS/tax returns — always double-check anything statutory with a real CA before relying on it.",
    access:
      "Available to both customers and staff, but it's not scoped by account_type/staff_level at all — it has its own separate per-book role system (Owner/Admin/Accountant/Employee/Viewer). A customer owns their own book by default; staff can be invited onto a customer's book with any of those roles, independent of their normal staff permissions elsewhere.",
    keywords: ["bookkeeping", "accounts", "expense", "income", "cash book", "bank"],
  },
  {
    path: "/dashboard/crm-access",
    title: "Request CRM Access",
    summary: "Request your own free CRM workspace, or check your request status.",
    details:
      "Every plan comes with a free year of a separate CRM workspace — your own admin login, your own team, your own leads pipeline, and your own invoicing, entirely apart from Legal Efilings' own CRM. This page is where a customer with at least one completed purchase requests it, tracks whether their request is pending/approved/rejected, and sees a preview of exactly what tools (Team Pipeline, Invoice Generator, Team Management, Attendance & Leave, Payroll) they'll unlock once approved. Approval is handled by a Legal Efilings platform admin, who promotes the requester's existing login to admin of a brand-new organization — same email/password, no new account to set up.",
    access: "Customer accounts only — a staff/admin account is redirected away, since they already have (or are) a CRM.",
    keywords: ["own crm", "workspace", "request access", "upgrade", "free crm", "organization"],
  },
  {
    path: "/dashboard/admin/leave-requests",
    title: "Team Leave Requests",
    summary: "Approve or reject leave requests from your reporting chain.",
    details:
      "Team Leave Requests is where a manager (leader/group_leader/admin) reviews and approves or rejects leave requests from the people who report to them, directly or through their chain. An already-approved request can also be cancelled here while the leave hasn't started yet, which returns those days to the employee's balance. This is different from the plain \"Leave\" page, which only ever shows your own requests.",
    access:
      "Visible only to leader/group_leader/admin (or a staff member whose configured department role is marked manager-level) — a plain rater doesn't get this page at all. You only see requests from people in your own reporting chain, except admin, who sees every request in the org.",
    keywords: ["approve", "reject", "manager", "team leave"],
  },
  {
    path: "/dashboard/admin/leave-types",
    title: "Leave Types",
    summary: "Define leave types with a yearly credit and carry-forward cap.",
    details:
      "Leave Types is where admin defines the org's own leave types (e.g. Casual Leave, Sick Leave, Earned Leave) — each with a yearly day credit (accrued monthly, computed automatically, no manual crediting needed) and a carry-forward cap (the max unused balance that rolls into next year; anything above the cap lapses at year end). Deactivating a type hides it from the Apply for Leave picker without touching existing history. \"Unpaid Leave\" is fixed and never appears here — it's always available to everyone with no balance or cap.",
    access: "Admin only, or a staff member individually delegated the \"Leave Types\" tool (see Delegated Access).",
    keywords: ["leave balance", "casual leave", "sick leave", "carry forward", "accrual", "credit"],
  },
  {
    path: "/dashboard/leave",
    title: "Leave",
    summary: "Apply for leave, cancel a request, and track your balance and status.",
    details:
      "Apply for leave here and track your own requests — pending, approved, cancelled, or rejected, with the reviewer's note if rejected. You can withdraw a request that's still pending, or cancel one that's already approved as long as the leave hasn't started yet — cancelling an approved request puts those days straight back into your balance. Once leave has started it can no longer be cancelled, since you were actually absent for it. This only ever shows your own leave, even if you're a manager; to approve your team's leave, use Team Leave Requests instead. Each org-defined leave type (see Leave Types) shows your current balance — carried forward from last year, accrued so far this year (credited monthly, automatically), and used. If a request would use more days than you have available, the extra days are automatically filed as Unpaid Leave instead of being blocked outright. \"Unpaid Leave\" itself has no balance or cap — it's always available.",
    access: "Every staff member (any level) — but always shows only your own requests and balance, never anyone else's, regardless of role.",
    keywords: ["apply", "vacation", "sick leave", "my leave", "balance", "carry forward", "cancel leave", "withdraw", "cancel request"],
  },
  {
    path: "/dashboard/admin/attendance",
    title: "Team Attendance",
    summary: "Review your team's check-ins and correction requests.",
    details:
      "Team Attendance lets a manager review check-in/check-out history for anyone on their team by month, download an attendance PDF, and approve or reject attendance correction requests.",
    access:
      "Visible only to leader/group_leader/admin (or a manager-level department role) — you pick which staff member to view from a dropdown scoped to your own reporting chain; admin can pick anyone in the org.",
    keywords: ["check in", "check out", "correction", "manager"],
  },
  {
    path: "/dashboard/attendance",
    title: "Attendance",
    summary: "Clock in/out and track your own hours.",
    details:
      "Clock in and out here, and see your own attendance log (hours worked per day). Correction requests live on their own page, linked from here.",
    access: "Every staff member (any level) — always your own attendance only. Not shown to customers at all.",
    keywords: ["clock in", "clock out", "check in", "hours"],
  },
  {
    path: "/dashboard/attendance/corrections",
    title: "Attendance Correction Requests",
    summary: "Your own attendance correction requests and their status.",
    details:
      "Submit a correction request if a check-in or check-out was missed or recorded wrong, and see the status (pending/approved/rejected) of every request you've made. Always your own requests only — the team-wide review queue is a separate admin page.",
    access: "Every staff member (any level) — always your own requests only.",
    keywords: ["correction", "fix attendance", "missed check in"],
  },
  {
    path: "/dashboard/payslips",
    title: "My Payslips",
    summary: "Every payslip generated for your account, downloadable as PDF.",
    details:
      "My Payslips lists every payslip generated for your own account, each downloadable as a PDF. To generate payslips for the whole team, that's the admin-only Payroll page instead.",
    access: "Every staff member (any level) — always your own payslips only.",
    keywords: ["salary", "download", "pdf"],
  },
  {
    path: "/dashboard/admin/payroll",
    title: "Payroll",
    summary: "Set salary structures and generate monthly payslips for staff.",
    details:
      "Payroll is where an admin sets each employee's salary structure (basic, HRA, special allowance, bonus, incentives) and generates payslips for a given month — it skips anyone who already has one for that month. PF/ESI/Professional Tax use simplified standard rates, so review the numbers before relying on them for actual statutory filing.",
    access: "Admin only (account_type = admin) — nobody else, including leader/group_leader, gets this page.",
    keywords: ["salary structure", "generate payslip", "pf", "esi", "professional tax"],
  },
  {
    path: "/dashboard/holidays",
    title: "Holidays",
    summary: "The company holiday calendar.",
    details: "A read-only calendar of the company's official holidays for the year.",
    access: "Every staff member (any level) can view; not shown to customers.",
    keywords: ["calendar", "holiday list"],
  },
  {
    path: "/dashboard/documents",
    title: "Documents",
    summary: "Upload and store employment/identity documents.",
    details:
      "Upload and manage your own documents (Aadhaar, PAN, offer letter, and similar). A manager can also view and upload for their own team, and admin can see and manage everyone's.",
    access:
      "A rater sees and uploads only their own documents. A leader/group_leader (or manager-level department role) additionally sees and can upload for their own reporting chain. Admin sees and manages everyone's in the org.",
    keywords: ["upload", "aadhaar", "pan", "id proof"],
  },
  {
    path: "/dashboard/admin/account-requests",
    title: "Account Requests",
    summary: "Pending account requests waiting on approval.",
    details:
      "Account Requests lists pending customer or staff account requests waiting for someone with the right role to action them. Everyone on staff can see this list, but only admin can actually approve one. Already-decided requests live on their own Reviewed Account Requests page.",
    access: "Every staff member (any level) can view the list; only admin can approve or reject a request.",
    keywords: ["approve account", "pending request", "new user"],
  },
  {
    path: "/dashboard/admin/reviewed-account-requests",
    title: "Reviewed Account Requests",
    summary: "Read-only history of approved and rejected account requests.",
    details:
      "Reviewed Account Requests shows the outcome of every account request that's already been decided — approved or rejected, with the rejection reason if any. No actions live here; approving/rejecting happens on the Account Requests (pending) page.",
    access: "Every staff member (any level) can view the list.",
    keywords: ["approved account", "rejected account", "account history"],
  },
  {
    path: "/dashboard/admin/users",
    title: "Create User",
    summary: "Admin creates a staff login directly; anyone else requests one.",
    details:
      "Admin creates a new staff account directly here. Anyone who isn't admin sees this same page as \"Request New User\" instead — it submits a request for admin to approve rather than creating the account outright.",
    access: "Every staff member sees this page, but what it does differs by role: admin creates the account immediately; anyone else (rater/leader/group_leader) only submits a request for admin to approve.",
    keywords: ["new staff", "create account", "add employee login"],
  },
  {
    path: "/dashboard/admin/employees",
    title: "Employees",
    summary: "The employee master record — department, designation, bank details.",
    details:
      "Employees is the admin-only master record for staff: department, designation, employee ID, date of joining, UAN/ESIC numbers, Aadhaar/PAN, bank details, staff level, department/role, and who they report to. These fields are set here by admin, not self-declared by the employee on their own profile page.",
    access: "Admin only — shows every employee in the org (or every org, for a platform_admin).",
    keywords: ["department", "designation", "uan", "esic", "reports to", "employee id"],
  },
  {
    path: "/dashboard/admin/departments",
    title: "Departments",
    summary: "Build your own department + role ladder for the team.",
    details:
      "Departments lets admin build a custom department and role ladder (e.g. Sales: Lead → Manager → Senior Manager) instead of relying only on the fixed rater/leader/group_leader levels. It's additive — the existing reporting-chain and role system still work if you skip this entirely.",
    access: "Admin only.",
    keywords: ["role ladder", "team structure", "hierarchy"],
  },
  {
    path: "/dashboard/admin/activity",
    title: "Activity Log",
    summary: "Who changed what, across invoices, orders, leads, and Business Finance.",
    details:
      "One timeline over every audit trail the system records — invoice events, order status changes, lead pipeline moves, and Business Finance entries — with the person who made each change and when. Filter by area, search by person or item, and export to CSV. Useful when a customer disputes something or you need to reconstruct what happened.",
    access: "Admin only — scoped to your own organization (or every org, for a platform_admin).",
    keywords: ["audit", "history", "who changed", "activity", "trail", "log"],
  },
  {
    path: "/dashboard/admin/tool-access",
    title: "Delegated Access",
    summary: "Grant one staff member access to one admin-only tool.",
    details:
      "Delegated Access lets admin hand a specific staff member access to a single normally admin-only (or group_leader-only) section — Employees, Departments, Payroll, Payslips, HR Letters, Invoice Item Catalog, Reports, Business Settings, Email Failures, or Analytics — without promoting them to admin or group_leader (which would also unlock every other admin section). A grant can be permanent or set to auto-expire on a chosen date. The delegated staff member sees the granted section appear in their own sidebar the next time they load the dashboard.",
    access: "Admin only — manages grants for staff within their own org. Not itself delegable.",
    keywords: ["delegate", "grant", "tool access", "permission", "temporary access"],
  },
  {
    path: "/dashboard/admin/hr-letters",
    title: "HR Letters",
    summary: "Generate offer, appointment, and other HR letters.",
    details: "Generate HR letters (offer letter, appointment letter, and similar) for an employee from a template.",
    access: "Admin only.",
    keywords: ["offer letter", "appointment letter", "template"],
  },
  {
    path: "/dashboard/admin/product-catalog",
    title: "Invoice Item Catalog",
    summary: "Products/services with HSN/SAC code, GST rate, and default price.",
    details:
      "The Invoice Item Catalog holds products and services with their HSN/SAC code, GST rate, unit, and a default rate. Picking one on an ad-hoc Invoice Generator line auto-fills those fields. This is separate from the public pricing pages — editing a price here only changes the autofill default on a new invoice line; it never changes what a customer pays through checkout or Buy Plan for Customer.",
    access: "Admin only.",
    keywords: ["hsn", "sac", "gst rate", "default price"],
  },
  {
    path: "/dashboard/admin/reports",
    title: "Data Exports",
    summary: "Company-wide HR/ops exports as CSV.",
    details: "Company-wide operational exports (like the full employee master) as CSV, for admin.",
    access: "Admin only — export is scoped to the admin's own org (or every org, for a platform_admin).",
    keywords: ["data export", "csv export", "hr export"],
  },
  {
    path: "/dashboard/admin/business-settings",
    title: "Business Settings",
    summary: "Company details, branding, and invoicing defaults — required before invoices can be generated.",
    details:
      "Business Settings holds the company's address, GSTIN, PAN, PF/ESIC numbers, state, financial-year start, logo and authorized-signature images, invoicing defaults (bank details, invoice number prefix, default notes), and any additional GST registrations. Address, GSTIN, PAN, State, and at least one payment method (bank details or UPI) are mandatory — invoice generation (Buy Plan for Customer, converting a lead, and the Invoice Generator wizard) is blocked with a clear error until these are filled in. These fields also show up on every generated invoice PDF and the customer-facing payment page.",
    access: "Admin only, or a staff member individually delegated the \"Business Settings\" tool (see Delegated Access).",
    keywords: ["logo", "signature", "gstin", "bank details", "invoice prefix", "business settings"],
  },
  {
    path: "/dashboard/admin/email-failures",
    title: "Email Failures",
    summary: "A log of emails the system tried and failed to send.",
    details:
      "A log of emails the system attempted and failed to send — most often new-account credential emails — so staff can follow up with that person manually instead of the message silently vanishing.",
    access: "Admin only.",
    keywords: ["failed email", "did not receive"],
  },
  {
    path: "/dashboard/admin/analytics",
    title: "Analytics",
    summary: "Company-wide revenue, leads, orders, and staff charts.",
    details: "Company-wide charts — revenue trend, leads funnel, order status breakdown, and a staff leaderboard.",
    access: "Visible to group_leader and admin only — a rater or leader doesn't get this page.",
    keywords: ["chart", "revenue", "funnel", "leaderboard"],
  },
  {
    path: "/dashboard/platform/organizations",
    title: "Organizations",
    summary: "Legal Efilings-operator-only: manage every tenant organization.",
    details:
      "Organizations is only visible to Legal Efilings' own platform operators (is_platform_admin), regardless of which org they happen to belong to. It creates and manages every tenant organization on the platform. Approving/rejecting a customer's own CRM access request lives on its own separate page — see CRM Requests.",
    access: "is_platform_admin only — a separate axis from account_type/staff_level entirely; not even a regular org's own admin sees this.",
    keywords: ["tenant", "platform admin", "create organization"],
  },
  {
    path: "/dashboard/platform/crm-requests",
    title: "CRM Requests",
    summary: "Legal Efilings-operator-only: approve or reject customer CRM workspace requests.",
    details:
      "CRM Requests is where a platform operator reviews every customer's request for their own CRM workspace (submitted from Request CRM Access) — approve one to promote that customer's existing login to admin of a brand-new organization, reject one with a note explaining why, and see the full history of past decisions.",
    access: "is_platform_admin only — same as Organizations, a separate axis from account_type/staff_level.",
    keywords: ["crm access", "approve", "reject", "workspace request", "platform admin"],
  },
  {
    path: "/dashboard/admin/leads",
    title: "Team Pipeline",
    summary: "The full sales pipeline for the team — board or table view.",
    details:
      "Team Pipeline shows the whole team's lead pipeline (or filter to one person's), as a drag-and-drop board grouped by stage or a sortable, paginated table. From here you can add a note (explicit Save/Discard, not autosave), change stage, reassign a lead, filter by received date, and convert a Won lead straight into a real customer account plus order.",
    access:
      "Visible only to leader/group_leader/admin (or a manager-level department role) — a plain rater doesn't get this page (they have My Leads instead). Shows every lead in your org, scoped to your reporting chain unless you're admin (whole org) or platform_admin (every org).",
    keywords: ["pipeline", "board", "kanban", "convert lead", "reassign"],
  },
  {
    path: "/dashboard/crm",
    title: "My Leads",
    summary: "Leads assigned to you, from first contact to close.",
    details:
      "My Leads is the leads assigned to you specifically — add a new one, track it through New → Contacted → In Progress → Won/Lost, and message them on WhatsApp directly from the row. For the whole team's pipeline, that's Team Pipeline instead.",
    access: "Every staff member (any level) — always only the leads assigned to you by name, even for a leader/group_leader/admin.",
    keywords: ["my pipeline", "assigned leads"],
  },
  {
    path: "/dashboard/admin/buy-for-customer",
    title: "Buy Plan for Customer",
    summary: "Start an order and invoice on a customer's behalf.",
    details:
      "Buy Plan for Customer is for a customer who called in instead of buying online — pick or create their account, pick the service/plan, and it creates the order, invoice, and a payment link (creating their login too if they're new).",
    access: "Any staff member or admin — not shown to customers.",
    keywords: ["phone order", "manual order", "sell over phone"],
  },
  {
    path: "/dashboard/invoice-crm",
    title: "Invoice Generator",
    summary: "Ad-hoc GST/non-GST invoicing, statements, and recurring invoices.",
    details:
      "Invoice Generator is for ad-hoc billing outside of a normal purchase — GST, non-GST, export, and proforma invoices, plus credit/debit notes, built line-by-line from the product/service catalog. It also has each customer's running account statement (every invoice raised and payment received, with a running balance), the full invoice list across all customers, and recurring invoice templates. For invoices tied to an actual order/purchase, see Order Invoices/My Invoices instead.",
    access: "Any staff member or admin, scoped to their own org (every org for platform_admin) — not shown to customers at all.",
    keywords: ["gst invoice", "credit note", "debit note", "statement", "ledger"],
  },
  {
    path: "/dashboard/invoices",
    title: "Order Invoices",
    summary: "Invoices generated from actual purchases.",
    details:
      "Order Invoices (shown to a customer as \"My Invoices\") lists invoices generated from a real purchase — Buy Plan for Customer or direct checkout. Customers can download or pay outstanding invoices here; staff can record a manual payment. Unpaid invoices chase themselves: the customer is emailed a reminder three days before the due date, then again at 1, 7, 14 and 30 days overdue, each with a direct payment link. Reminders stop as soon as the balance is cleared. For billing that isn't tied to a purchase — ad-hoc GST invoices, credit/debit notes — use Invoice Generator instead.",
    access:
      "A customer sees only their own invoices. Staff see invoices they created plus their reporting chain's; admin sees every invoice in the org (every org for platform_admin).",
    keywords: ["my invoices", "pay invoice", "download invoice", "record payment", "reminder", "overdue", "chase payment", "dunning"],
  },
  {
    path: "/dashboard/orders",
    title: "Orders",
    summary: "Every order, with payment, process, and document status.",
    details:
      "Orders lists every order with three independently tracked signals: Payment status (from that order's invoice — paid, pending, overdue), Process status (the actual filing/registration pipeline stage), and Document status (whether required documents have been uploaded and verified). \"Ready to work\" filters to orders that are paid, verified, and not yet finished.",
    access:
      "A customer sees only their own orders. Staff see orders assigned to them plus their reporting chain's; admin sees every order in the org (every org for platform_admin).",
    keywords: ["order status", "process status", "document status", "ready to work"],
  },
  {
    path: "/dashboard/profile",
    title: "Edit Profile",
    summary: "Your own name, contact info, and identity/bank details.",
    details:
      "Edit your own name, email, phone, date of birth, state/city, and identity/bank details. Org-assigned fields — department, designation, UAN, ESIC — aren't editable here; admin sets those in Employees instead.",
    access: "Everyone, staff and customer alike — always your own profile only; there's no way to view or edit anyone else's from this page.",
    keywords: ["my details", "contact info", "bank details"],
  },
  {
    path: "/dashboard",
    title: "Overview",
    summary: "Your account at a glance, with quick links into the rest of the app.",
    details:
      "Overview shows a quick-glance summary — your leads/invoices/orders counts (or, for admin, company-wide HR stats too), recent orders and invoices, and a getting-started checklist for a brand-new company account. Every stat links through to the full page it summarizes.",
    access:
      "Everyone sees this page, but the content is scoped per role: a customer sees their own orders/invoices; staff see their own leads/invoices/orders (plus reporting chain); admin additionally sees a company-wide HR Overview block (present today, attendance, birthdays, payroll due) scoped to their org, or every org for platform_admin.",
    keywords: ["dashboard home", "summary", "getting started"],
  },
];

// Longest-path-first, so a lookup naturally prefers the most specific
// matching entry (e.g. /dashboard/finance/recurring over /dashboard/finance)
// without every call site needing to think about ordering.
const SORTED_MANUAL = [...DASHBOARD_MANUAL].sort((a, b) => b.path.length - a.path.length);

export function getManualEntry(pathname: string): ManualEntry | null {
  return SORTED_MANUAL.find((e) => pathname === e.path || pathname.startsWith(`${e.path}/`)) ?? null;
}
