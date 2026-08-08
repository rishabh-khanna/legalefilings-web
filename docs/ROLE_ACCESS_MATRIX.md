# Role & Access Matrix

Plain-language reference for who can see and do what in the Legal Efilings platform. Written for the founder/admin, not for developers reading source code. Last reviewed against the codebase on 2026-08-03.

---

## Role Summary

There are actually **two separate role systems** in this app, layered on top of each other. Mixing them up is the single most common source of confusion, so read this section carefully before the tables below.

### System 1: The main platform role model (applies everywhere except Business Finance)

| Axis | Values | Plain-English meaning |
|---|---|---|
| `account_type` | `customer`, `staff`, `admin` | The big switch. A **customer** bought services from an org (e.g. Legal Efilings itself, or a reseller org) and only ever sees their own stuff. **Staff** and **admin** work *for* an org, selling/servicing customers and running HR internally. |
| `staff_level` | `rater`, `leader`, `group_leader` | Only meaningful when `account_type = staff`. A fixed 3-tier seniority ladder *within* staff — a `rater` is the most junior (does the day-to-day work), a `leader` manages raters, a `group_leader` manages leaders (and sits just below `admin`). Analogy: rater = individual contributor, leader = team lead, group_leader = department head. |
| `reports_to` | points to another profile | Every staff member (except the top of the chain) has a manager. This forms a literal org chart in the database. A leader/group_leader's "team" is computed by walking this chain downward — not by any separate "team" field. |
| `is_platform_admin` | `true` / `false` | **This is not the same as `account_type = admin`.** `admin` is the top of one specific organization (e.g. the admin of "Acme Legal Services"). `is_platform_admin` is Legal Efilings' own internal super-user flag — it belongs only to Legal Efilings employees who operate the platform itself, and it lets them see and manage *every* organization at once, cutting across all the org boundaries below. Analogy: `admin` is "the manager of one store"; `is_platform_admin` is "the person who owns the whole mall and can walk into any store." |
| `organization_id` | every profile has exactly one | Every customer, staff member, and admin belongs to exactly one organization (a tenant). Staff/admin only ever see data — leads, orders, invoices, other staff — inside their own organization. Only an `is_platform_admin` user sees across all organizations at once. |
| `customer_tier` | `free`, `paid` | A **customer-only** distinction, nothing to do with permissions/roles as such — it's more like a subscription plan flag. A `paid` customer unlocks a self-serve GST invoicing wizard and CRM workspace access; a `free` customer is view-only on their own invoices/orders. |

**Rule of thumb for who sees what data (outside Business Finance):**
- A **customer** sees only their own orders/invoices/documents.
- A **rater** sees their own work, plus whatever is unassigned in their org.
- A **leader** or **group_leader** additionally sees everyone below them in the `reports_to` chain (their team).
- An **admin** sees everything in their own organization.
- A **platform_admin** sees everything, in every organization.

**Approving vs. seeing are different bars.** A group_leader can *see* attendance/leave several levels down their chain (oversight), but can only *approve* a request from someone who reports to them **directly** — a group_leader can't skip past a rater's actual leader and approve the rater's leave themselves. Admin can approve anyone within their own org; platform_admin can approve anyone anywhere.

### System 2: Business Finance's own per-book roles (completely separate system)

The "Business Finance" module (`/dashboard/finance/*`, "Business Finance" in the nav) lets a customer track their own company's bank accounts, expenses, income, budgets, etc. — think of it as a mini bookkeeping tool bundled into the platform. Access to it is **not** governed by `account_type`/`staff_level` at all. Instead, each customer has their own "book," and anyone (customer or staff) can be invited into that specific book with one of five roles:

| Book role | Can add transactions | Can delete/edit transactions | View & download reports | Manage members & thresholds | Manage bank accounts |
|---|---|---|---|---|---|
| `owner` | Yes | Yes | Yes | Yes | Yes |
| `admin` | Yes | Yes | Yes | Yes | Yes |
| `accountant` | Yes | No | Yes | No | No |
| `employee` | Yes | No | View only, no download restriction noted as "view" | No | No |
| `viewer` | No | No | Yes (view + download) | No | No |

**Important:** this "admin"/"owner" is scoped to *one customer's book*, not the whole organization. A Legal Efilings `staff` member could be invited as an `accountant` on one customer's book and have zero special access anywhere else in the platform. Someone with `is_platform_admin = true` has **no automatic access** to any customer's Business Finance book — that system doesn't know or care about `is_platform_admin` at all; you have to be added as a member like anyone else.

---

## Dashboard Pages

Route guarding for everything under `/dashboard/*` happens first in `src/proxy.ts` (the app's route guard, formerly "middleware"): you must be signed in for any `/dashboard` page; `/dashboard/admin/*` requires staff or admin (not customer); a further subset of `/dashboard/admin/*` requires admin only, or group_leader-and-up; and `/dashboard/platform/*` requires `is_platform_admin`. Many pages then *also* re-check the role in their own code ("defense in depth"); some pages trust the route guard alone. That distinction is called out below.

| Page | Route | Who can access | What they can do there |
|---|---|---|---|
| Overview | `/dashboard` | Everyone signed in | Customer: sees own recent orders/invoices + a card to request CRM access. Staff/admin: sees counts scoped to their own work + reporting-chain team; admin additionally sees org-wide (or platform-wide, if platform_admin) HR summary — headcount, attendance, birthdays, payroll due, pending leave. |
| Access Expired | `/dashboard/access-expired` | Anyone whose org's CRM/finance access has lapsed (allowlisted regardless of role) | Static notice explaining access lapsed, with a way to log out or reach profile. |
| Profile | `/dashboard/profile` | Anyone signed in | Edit their own name/contact info; staff/admin see extra HR fields (bank details, Aadhaar/PAN, emergency contact). |
| My Leads (CRM) | `/dashboard/crm` | Any staff or admin | View/manage leads assigned to them by name, add new leads. Not scoped by org or reporting chain in the page itself — relies on the leads API. |
| Buy Plan for Customer | `/dashboard/admin/buy-for-customer` | Any staff or admin (route-guard only, no in-page check) | Start an order + payment link for a customer who called in. |
| Order Invoices | `/dashboard/invoices` | Everyone, behavior differs | Staff/admin: view/manage all order-linked invoices, record payments. Paid customers: self-serve GST invoicing + view/pay their own. Free customers: view own invoices only, no self-serve creation. |
| Invoice CRM | `/dashboard/invoice-crm` | Staff/admin only (page itself blocks customers from loading data even though the route guard alone would let a customer's browser reach it) | Full ad-hoc invoicing workspace: GST/non-GST/export/proforma/credit-debit notes, catalog, customer ledger, recurring invoices. |
| Orders | `/dashboard/orders` | Everyone, scoped differently | Customer: their own order history. Rater/leader: their own + reporting-chain-assigned orders. Admin: all orders in their org (or all orgs, if platform_admin). |
| Business Finance (all `/dashboard/finance/*` pages: overview, activity, budgets, import, recurring, reports, settings, team) | `/dashboard/finance*` | Anyone signed in reaches the URL; actual usefulness is gated by their per-book role (see System 2 above) | View balances/transactions, manage budgets, import an invoice as an expense, manage recurring bills, generate reports, change book settings, and manage who else has access — each action's real permission is enforced by the API, not the page. |
| Attendance | `/dashboard/attendance` | Any staff/admin | Clock in/out (with geolocation), submit correction requests. |
| Leave | `/dashboard/leave` | Any staff/admin | Submit own leave requests, view own request history. |
| My Payslips | `/dashboard/payslips` | Any staff/admin | View/download own payslips only. |
| Holidays | `/dashboard/holidays` | Any staff/admin | View company holiday calendar; admin can add/remove holidays. |
| Documents | `/dashboard/documents` | Any staff/admin | Upload/view own HR documents; admin (and, per reporting chain, leader/group_leader) can view team members' documents via a staff switcher. |
| Account Requests | `/dashboard/admin/account-requests` | Any staff/admin (route-guard only) | View pending "new user account" requests. Only admin can approve/reject (page shows the buttons only to admin; enforced again by the API). |
| Create/Request User | `/dashboard/admin/users` | Any staff/admin | Admin creates a live account directly; anyone else submits a request into the approval queue instead. |
| Team Leads CRM | `/dashboard/admin/leads` (also the target of `/dashboard/admin`) | Leader, group_leader, admin (route-guard treats it as any staff/admin; nav link is hidden from raters) | Kanban/table view of the team's leads, drag-and-drop stage changes, WhatsApp follow-up. |
| Team Attendance | `/dashboard/admin/attendance` | Leader, group_leader, admin (nav-restricted; route guard alone would allow any staff) | View/approve team attendance and correction requests for direct/indirect reports. |
| Team Leave Requests | `/dashboard/admin/leave-requests` | Leader, group_leader, admin (nav-restricted) | Approve/reject leave requests — but only if the page loader is that person's **direct** manager, or the caller is admin; the page shows a clear "only this person's direct manager can approve" message otherwise. |
| Analytics | `/dashboard/admin/analytics` | Admin or group_leader only (enforced by the route guard) | Company-wide revenue/leads/orders/staff-leaderboard charts. |
| Employees | `/dashboard/admin/employees` | Admin only | Edit employee HR master records (department, designation, staff_level, bank/UAN/ESIC details). |
| Payroll | `/dashboard/admin/payroll` | Admin only | Set salary structures, generate and view payslips for staff. |
| HR Letters | `/dashboard/admin/hr-letters` | Admin only | Generate offer/appointment/etc. letter PDFs from templates. |
| Item Catalog | `/dashboard/admin/product-catalog` | Admin only | CRUD the products/services catalog (HSN/SAC codes, GST rates, default pricing). |
| Reports | `/dashboard/admin/reports` | Admin only | Export CSV reports (attendance, salary, leave, employee list, department breakdown, invoice ageing). |
| Company Settings | `/dashboard/admin/company-settings` | Admin only | Edit the org's GST/PAN/bank/logo/invoice-numbering settings. |
| Organizations (Platform) | `/dashboard/platform/organizations` | `is_platform_admin` only | Create/view every organization on the platform; review cross-org CRM access requests. This is the Legal-Efilings-operator screen, not visible to any customer org's own admin. |

---

## API Routes

### Orders

| Route + Method | Who can call it | What it does |
|---|---|---|
| `POST /api/orders/buy-for-customer` | Any staff/admin, target customer must be in caller's org (platform_admin exempt) | Starts an order + invoice on a customer's behalf and emails them a pay link. |
| `GET /api/orders/[id]/documents` | Owning customer; or staff/admin in-org where, if not admin, the order is unassigned or assigned within the caller's reporting chain | List an order's uploaded documents. |
| `POST /api/orders/[id]/documents` | Same access rule as above (owning customer included) | Uploads a document; first upload flips the order to "submitted." |
| `PATCH /api/orders/[id]/documents` | Staff/admin only, same access rule | Sets the order's overall document status. |
| `PATCH /api/orders/[id]/documents/[docId]` | Staff/admin only, same access rule | Verifies or rejects one document with a review note. |
| `DELETE /api/orders/[id]/documents/[docId]` | Anyone who can reach the order; a customer caller must additionally be the original uploader | Deletes a document. **Note:** unlike invoices, staff/admin have no "only my own uploads" restriction here — any staff who can see the order can delete any document on it, including one a customer uploaded. |
| `GET /api/orders/[id]/documents/[docId]/download` | Same access rule as the list route | Signed, time-limited download link. |
| `GET /api/customers` | **Any signed-in profile** — no role check beyond being logged in | Lists customers in the caller's org (org-scoped, not role-scoped) — meaning a customer account can list every other customer in the same org. |
| `POST /api/payments/checkout` | Public, no login required | Self-checkout from a pricing card; creates the customer account, order, invoice, and a Razorpay payment session. |
| `POST /api/payments/create-order` | Public, no login required | Starts a Razorpay payment for an existing unpaid invoice (invoice ID itself is the access token). |
| `POST /api/payments/verify` | Public, but requires a valid Razorpay signature | Marks an invoice paid after checkout succeeds in the browser. |
| `POST /api/payments/webhook` | Public, gated by a Razorpay HMAC signature (not a user login) | Backstop that marks an invoice paid via Razorpay's own webhook. |

### Invoices

| Route + Method | Who can call it | What it does |
|---|---|---|
| `GET /api/invoices` | Everyone — customer sees own; rater sees ones they created; leader/group_leader sees own + team's; admin sees org (platform_admin sees all) | List invoices, scoped to the caller. |
| `POST /api/invoices` | Staff/admin for any customer, or a **paid** customer for themselves | Creates a GST invoice (customer self-serve is forced non-GST/no discounts). |
| `GET /api/invoices/[id]` | Owning customer, or staff/admin passing the org+chain check | Fetch one invoice with line items. |
| `PATCH /api/invoices/[id]` | Staff/admin only, org+chain check, and only while the invoice is still a draft | Replaces line items and recomputes totals. |
| `POST /api/invoices/[id]/mark-paid`, `/record-payment`, `/send`, `/send-email`; `GET /history` | Staff/admin, org+chain scoped | Record a payment, send the invoice, or view its history. |
| `GET /api/invoices/[id]/attachments` | Owning customer, or staff/admin (org+chain) | List invoice attachments. |
| `POST /api/invoices/[id]/attachments` | Staff/admin only | Upload a supporting document. |
| `GET /api/invoices/[id]/attachments/[attachmentId]/download` | Owning customer, or staff/admin (org+chain) | Signed download link. |
| `GET /api/invoices/export` | Staff/admin, org+chain scoped | CSV export of the same invoice list. |
| `GET /api/invoices/ledger` | Any user for their own invoices; staff/admin for any customer, **org-scoped but with no reporting-chain restriction** | Full payment ledger with running balance. **Note:** this is looser than the main invoice list — a rater can pull another rater's customer's ledger even though they can't see that colleague's invoices in the list view. |
| `GET/POST /api/recurring-invoices` | Staff/admin, org-scoped | Manage recurring invoice templates. |
| `GET /api/recurring-invoices/run` | Either a cron secret header (processes every org) or a real staff/admin session (processes their own org, "Run Now" button) | Generates due recurring invoices. |
| `GET /api/product-service-master` | Any signed-in profile, org-scoped | List the catalog. |
| `POST /api/product-service-master`, `PATCH/DELETE .../[id]` | Admin only, org-scoped | Manage catalog items. |
| `GET /api/company-gst-registrations` | Any signed-in profile, org-scoped | List GST registrations. |
| `POST .../route.ts`, `DELETE .../[id]` | Admin only, org-scoped | Add/remove a GST registration. |

### CRM / Leads

| Route + Method | Who can call it | What it does |
|---|---|---|
| `GET /api/leads` | Staff/admin — rater sees own-assigned + unassigned + team's; admin sees org (platform_admin sees all orgs) | List leads. |
| `POST /api/leads` | Public (consultation form) or any staff/admin (manual add) | Creates a lead. |
| `PATCH /api/leads` | Staff/admin, org-scoped; a "claim" action does first-come-first-served assignment | Update a lead's stage/notes, or claim an unassigned one. |
| `GET /api/leads/[id]/history` | Staff/admin, org-scoped | Lead activity log. |
| `GET /api/crm-access-requests` | Customer sees their own requests; platform_admin sees every org's; any other staff/admin is blocked (403) | View CRM workspace access requests. |
| `POST /api/crm-access-requests` | Customer only, and only if they have at least one paid invoice | Requests a CRM workspace (bundled with a purchase). |
| `PATCH /api/platform/crm-access-requests/[id]` | `is_platform_admin` only | Approve (spins up a brand-new org with the requester as its admin) or reject a request. |

### HR / Attendance / Leave / Payroll

| Route + Method | Who can call it | What it does |
|---|---|---|
| `POST /api/attendance` | Any staff/admin | Clock in/out for self. |
| `GET /api/attendance` | Own record by default; someone else's only if `canManageStaff` allows it (admin in-org, or the caller's own reporting-chain descendant) | View attendance. |
| `GET/POST /api/attendance-corrections` | Staff/admin, org-scoped | View/submit correction requests. |
| `PATCH /api/attendance-corrections/[id]` | Admin (anyone in-org) or the requester's **direct** manager only | Approve/reject a correction; approval writes real attendance events. |
| `GET/POST /api/leave-requests` | Staff/admin, org-scoped | View/submit leave requests. |
| `PATCH /api/leave-requests/[id]` | Admin (in-org) or the requester's **direct** manager only | Approve/reject a leave request. |
| `GET /api/holidays` | Staff/admin, org-scoped | List holidays. |
| `POST /api/holidays`, `DELETE /api/holidays/[id]` | Admin only, org-scoped | Add/remove holidays. |
| `POST /api/payroll/generate` | Admin only, org-scoped | Bulk-generates payslips for a month/year. |
| `GET/POST /api/payroll/salary-structure` | Admin only; target staff must be in caller's org | View/set salary structure (append-only history). |
| `GET /api/payroll/payslips` | Admin sees org (or all, if platform_admin); everyone else sees only their own | List payslips. |
| `GET /api/employee-documents` | Own docs by default; someone else's requires `canManageStaff` | List HR documents. |
| `POST /api/employee-documents` | Any staff/admin for themselves; uploading **on someone else's behalf requires being admin** — a leader/group_leader cannot upload for their own reports, only view what those reports upload | Upload an HR document. |
| `GET /api/employee-documents/[id]/download` | Anyone `canManageStaff` allows | Signed download link. |
| `GET /api/admin/employees` | Admin only, org-scoped | List staff/admin HR records. |
| `PATCH /api/admin/employees/[id]` | Admin only, org-scoped | Edit HR fields including staff_level. |
| `DELETE /api/admin/employees/[id]` | Admin only, org-scoped, cannot delete self | Deletes the account. |
| `POST /api/admin/create-user` | Admin only; the chosen manager (`reportsTo`) must be in caller's org | Directly creates any account — no approval step. |
| `GET /api/account-requests` | `?email=` lookup is public (status check only); otherwise staff/admin, org-scoped | Public status check, or the approval queue. |
| `POST /api/account-requests` | Public, no login | Self-signup request (always lands in the Legal Efilings org). |
| `PATCH /api/account-requests/[id]` | Admin only, org-scoped | Approve/reject a request and provision the account. |
| `POST /api/account-requests/request-user` | Any staff/admin | Requests a new (non-admin) account into the approval queue. |
| `GET /api/team-members` | Admin sees org (or all, if platform_admin); everyone else sees self + reporting chain | Staff picker list used across HR pages. |

### Business Finance (`/api/expense-manager/**`) — governed by the separate per-book role system

Every route below first checks the caller has a membership row on the specific book (`getBookAccess`) — no membership, no access, regardless of `account_type`/`staff_level`/`is_platform_admin`. Most then also check a specific permission from the System 2 table above.

| Route + Method | Who can call it | What it does |
|---|---|---|
| `GET/POST /api/expense-manager/setup` | Customers only (staff self-serve setup isn't supported yet) | View/create their own business profile and initial accounts; also creates their `owner` membership row. |
| `GET /api/expense-manager/my-books` | Anyone signed in | Lists every book the caller belongs to. |
| `GET /api/expense-manager/accounts`, `/categories`, `/transactions`, `/members` | Any book member (even `viewer`) | Read-only listing endpoints — membership alone is the bar, no extra permission check. |
| `POST /api/expense-manager/accounts`, `PATCH/DELETE .../[id]` | Book member with `manage_accounts` (owner/admin only) | Add/edit/close a bank account. |
| `POST /api/expense-manager/categories` | Book member with `add_expense` (everyone except viewer) | Add a custom category. |
| `POST /api/expense-manager/transactions` | Book member with `add_expense` | Record an expense/income; auto-flags as pending if the submitter is `employee` and the book requires approval. |
| `PATCH/DELETE /api/expense-manager/transactions/[id]` | Book member with `delete_expense` (owner/admin only) | Edit **or** delete a transaction — note editing shares the delete permission, so an `accountant`/`employee` can't fix their own typo without an owner/admin doing it. |
| `PATCH /api/expense-manager/transactions/[id]/review` | Book member with `delete_expense` (owner/admin) | Approve/reject a pending entry. |
| `GET/POST /api/expense-manager/transactions/[id]/documents`, `download` | Book member with `view_reports`/`add_expense` respectively | Attach and view supporting documents on a transaction. |
| `POST /api/expense-manager/transactions/import-invoice`, `GET /importable-invoices` | Book member with `add_expense` | Converts a paid Legal Efilings invoice into an expense/income record. |
| `GET/POST /api/expense-manager/budgets`, `DELETE .../[id]` | Book member; GET needs `view_reports`, POST/DELETE need `manage_accounts` | Set/view monthly category budgets. |
| `GET/POST /api/expense-manager/recurring`, `PATCH/DELETE .../[id]` | Book member; GET needs `view_reports`, others need `manage_accounts` | Manage recurring bill/income templates. |
| `POST /api/expense-manager/members`, `PATCH/DELETE .../[id]` | Book member with `manage_users` | Invite/remove members, change their book role. |
| `PATCH /api/expense-manager/settings` | Book member with `manage_users` | Change approval-required flag and alert thresholds. |
| `GET /api/expense-manager/audit-log` | Book member with `manage_users` | View the book's action history. |
| `GET /api/expense-manager/charts`, `/summary` | Book member with `view_reports` (summary is lenient: an unset-up book just reports "not set up yet" without a full check) | Dashboard chart data and KPI numbers. |

### Platform / Organizations

| Route + Method | Who can call it | What it does |
|---|---|---|
| `GET/POST /api/platform/organizations` | `is_platform_admin` only | List all organizations (with member counts) / create a new one with default settings. |
| `PATCH /api/platform/crm-access-requests/[id]` | `is_platform_admin` only | Approve/reject a CRM access request (see CRM section). |
| `GET /api/company-settings` | Any signed-in profile, org-scoped | Fetch the org's company settings. |
| `PATCH /api/company-settings` | Admin only, org-scoped | Edit company settings. |
| `POST /api/company-settings/upload-asset` | Admin only | Upload a logo/letterhead asset. |

### Documents

Document-serving routes already appear above under their owning feature area — repeated here for completeness:

| Route + Method | Who can call it | What it does |
|---|---|---|
| `/api/orders/[id]/documents/**` | See Orders section | Order-attached document upload/verify/download. |
| `/api/invoices/[id]/attachments/**` | See Invoices section | Invoice-attached document upload/download. |
| `/api/employee-documents/**` | See HR section | HR document upload/download, scoped by `canManageStaff`. |

All three families follow the same shape: load the parent resource, check org + role/reporting-chain access, then issue a short-lived signed URL for the actual file — files are never served directly.

### Reports & Cron

| Route + Method | Who can call it | What it does |
|---|---|---|
| `GET /api/reports` | Admin only, org-scoped (or all orgs, if platform_admin) | Aggregated dashboard reports (headcount, department breakdown, leave, invoice ageing). |
| `GET /api/cron/birthdays` | A `CRON_SECRET` bearer header — **but only if that env var is actually set**; if unset, the check is skipped entirely | Emails birthday wishes to everyone, across every org. |
| `GET /api/cron/expense-recurring` | Same `CRON_SECRET`-if-set pattern | Generates due recurring Business Finance entries and sends bill reminders, across every org. |

---

## Known Gaps / Things Worth Knowing

These are things that stood out while reading the actual enforcement code — not hypothetical risks, but real asymmetries or soft spots worth the founder/admin knowing about.

1. **Cron routes fail open if `CRON_SECRET` is ever unset.** `/api/cron/birthdays` and `/api/cron/expense-recurring` only check the secret header `if (cronSecret && authHeader !== ...)` — meaning if that environment variable is missing or misconfigured in any deployment, both routes become fully public with **no authentication at all**, and anyone who finds the URL can trigger mass emails / generate financial transactions across every organization on the platform. `/api/recurring-invoices/run` has a safer version of the same pattern: if the cron header doesn't match, it falls back to requiring a real staff/admin login (org-scoped) rather than opening up entirely. Worth making the other two crons behave the same way, or at minimum verifying `CRON_SECRET` is always set in every environment.

2. **`/api/customers` has no role check at all** — any signed-in user, including a plain customer account, can list every other customer in their organization (name, contact info) via this endpoint. It's org-scoped but not role-scoped, unlike almost every other list endpoint in the app.

3. **Staff can delete any document on an order, even ones a customer uploaded.** `/api/orders/[id]/documents/[docId]` DELETE only restricts a *customer* caller to their own uploads. Any staff/admin who can reach the order at all (which includes unassigned orders, visible to any staff in the org) can delete any document on it — there's no "only if I uploaded it, or someone in my reporting chain did" restriction the way invoices have. Worth a look if document deletion needs to be auditable/reversible.

4. **Invoice ledger access is looser than the invoice list itself.** `/api/invoices/ledger` restricts staff by organization only — a rater can pull the full payment ledger for a colleague's customer, even though the plain invoice list (`/api/invoices`, `/api/invoices/export`) correctly restricts a rater to invoices they personally created or their reporting chain created. Same data, different strictness, on two closely related endpoints.

5. **A leader/group_leader can view their team's HR documents but cannot upload one on their behalf** — `/api/employee-documents` POST only allows uploading for someone else if the caller is `admin`, while the corresponding GET allows anyone `canManageStaff` covers (which includes leader/group_leader over their team). Likely intentional (uploading sensitive HR paperwork is a more privileged act than viewing it), but it's an asymmetry between the two handlers in the same file that's easy to trip over.

6. **Editing and deleting a Business Finance transaction share one permission (`delete_expense`).** Only `owner`/`admin` book roles can edit a transaction at all — an `accountant` or `employee` who makes a typo entering their own expense cannot fix it themselves; only an owner/admin can, even though `accountant`/`employee` are explicitly allowed to *create* entries. This is a real ceiling on those two roles' day-to-day usefulness, not a security gap, but worth knowing if it causes friction.

7. **Business Finance pages do no page-level role checks of their own** (`/dashboard/finance/*` — team, settings, activity, budgets, recurring, reports, import all just fetch and render, trusting the API to reject unauthorized actions). This is a consistent, deliberate pattern across the whole module (confirmed by comments in the code itself), not a one-off oversight — but it does mean the UI will happily *render* management controls to a `viewer` who navigates there directly; those actions will simply fail server-side rather than being hidden. No actual data leaks, just a slightly confusing UX for low-privilege book members.

8. **`/dashboard/admin/analytics` has no organization filter in its own page code.** The route guard correctly restricts the *page* to admin/group_leader, but the Supabase queries the page runs against invoices/leads/orders don't visibly scope by `organization_id` the way almost every other admin page does. If Postgres row-level security isn't independently enforcing org isolation on those specific queries, a group_leader could see another organization's revenue numbers on this one screen. Worth an explicit check against the underlying RLS policies.

9. **`is_platform_admin` has no automatic reach into Business Finance.** This is by design (System 2 is intentionally separate — see Role Summary), but worth remembering: the platform's own super-admin cannot see into any customer's Business Finance book unless someone explicitly adds them as a member of that specific book. If a founder ever needs to help debug a customer's books, they'll need to be invited in like anyone else.

10. **Most admin-only and team-management pages rely entirely on the route guard (`proxy.ts`), with no matching check inside the page itself.** This is true of Employees, Payroll, HR Letters, Product Catalog, Reports, Company Settings, Analytics, Team Leads, Team Attendance, and Team Leave Requests. It's a consistent, sensible pattern (one gate, not duplicated everywhere) but it does mean the route guard is a single point of failure for those ten pages — if it were ever bypassed or misconfigured, none of those pages would independently notice. By contrast, `/dashboard`, `/dashboard/orders`, `/dashboard/invoices`, and `/dashboard/invoice-crm` all re-verify the caller's role in their own code as a second line of defense.
