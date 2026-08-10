import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { canSeeAllOrgs } from "@/lib/organization";

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  href: string;
  at: string | null;
  // "act" = someone is blocked until this person does something.
  // "watch" = worth knowing, nobody is waiting on them.
  tone: "act" | "watch";
};

// GET /api/notifications — everything currently waiting on this person.
//
// Derived from live state rather than stored notification rows, on
// purpose. Every item here is a question the database can already
// answer ("which leave requests are still pending my approval?"), and
// deriving it means an item disappears the moment it's actioned — a
// stored row would need its own lifecycle and would eventually show
// people notifications for things that were dealt with days ago.
//
// The tradeoff: no read/unread and no dismiss. For an "attention
// required" list that's the right call — the queue clearing itself as
// you work is the behaviour you want. A separate activity feed would be
// the place for history.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const items: NotificationItem[] = [];
  const isAdmin = profile.account_type === "admin";
  const isStaff = profile.account_type === "staff" || isAdmin;
  const orgId = profile.organization_id;

  if (profile.account_type === "customer") {
    // Two things a customer can actually be blocked on: paperwork we're
    // waiting for, and money they owe.
    const [{ data: orders }, { data: invoices }] = await Promise.all([
      supabase
        .from("orders")
        .select("id, service, document_status, created_at")
        .eq("customer_id", profile.id)
        .eq("document_status", "awaiting")
        .not("status", "in", "(completed,cancelled)")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("invoices")
        .select("id, invoice_number, total, status, due_at")
        .eq("customer_id", profile.id)
        .in("status", ["sent", "partially_paid", "overdue"])
        .order("due_at", { ascending: true })
        .limit(10),
    ]);

    for (const o of orders ?? []) {
      items.push({
        id: `doc-${o.id}`,
        kind: "documents_needed",
        title: "Documents needed",
        detail: `Upload the paperwork for your ${o.service}.`,
        href: "/dashboard/orders",
        at: o.created_at,
        tone: "act",
      });
    }
    for (const inv of invoices ?? []) {
      const overdue = inv.status === "overdue";
      items.push({
        id: `inv-${inv.id}`,
        kind: overdue ? "invoice_overdue" : "invoice_due",
        title: overdue ? "Invoice overdue" : "Invoice awaiting payment",
        detail: `${inv.invoice_number} — ₹${Number(inv.total).toLocaleString("en-IN")}`,
        href: `/pay/${inv.id}`,
        at: inv.due_at,
        tone: "act",
      });
    }
    return NextResponse.json({ items: sortItems(items) });
  }

  if (!isStaff && !profile.is_platform_admin) {
    return NextResponse.json({ items: [] });
  }

  // Who this person can approve for: themselves excluded, their
  // reporting chain included. Admins see their whole org.
  const chain = await getReportingChainIds(profile.id);
  const approvableIds = chain.filter((id) => id !== profile.id);

  const leaveQuery = supabase
    .from("leave_requests")
    .select("id, start_date, end_date, created_at, profiles!leave_requests_staff_id_fkey(full_name)")
    .eq("status", "pending")
    .neq("staff_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (isAdmin || canSeeAllOrgs(profile)) {
    if (!canSeeAllOrgs(profile)) leaveQuery.eq("organization_id", orgId);
  } else if (approvableIds.length) {
    leaveQuery.in("staff_id", approvableIds);
  } else {
    leaveQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  const correctionQuery = supabase
    .from("attendance_corrections")
    .select("id, date, created_at, profiles!attendance_corrections_staff_id_fkey(full_name)")
    .eq("status", "pending")
    .neq("staff_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (isAdmin || canSeeAllOrgs(profile)) {
    if (!canSeeAllOrgs(profile)) correctionQuery.eq("organization_id", orgId);
  } else if (approvableIds.length) {
    correctionQuery.in("staff_id", approvableIds);
  } else {
    correctionQuery.eq("id", "00000000-0000-0000-0000-000000000000");
  }

  // Documents waiting on a human to verify or reject.
  const docsQuery = supabase
    .from("order_documents")
    .select("id, file_name, created_at, order_id, orders!inner(service, assigned_to, organization_id)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);
  if (!canSeeAllOrgs(profile)) docsQuery.eq("organization_id", orgId);
  if (!isAdmin && !canSeeAllOrgs(profile)) docsQuery.eq("orders.assigned_to", profile.id);

  // The shared unclaimed lead pool — newly reachable by non-admins now
  // that leads scope by id and include NULL assignees.
  const leadsQuery = supabase
    .from("leads")
    .select("id, name, service, created_at")
    .is("assigned_to", null)
    .order("created_at", { ascending: false })
    .limit(5);
  if (!canSeeAllOrgs(profile)) leadsQuery.eq("organization_id", orgId);

  const [leaveRes, corrRes, docsRes, leadsRes] = await Promise.all([leaveQuery, correctionQuery, docsQuery, leadsQuery]);

  for (const r of leaveRes.data ?? []) {
    const who = (r.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "A team member";
    items.push({
      id: `leave-${r.id}`,
      kind: "leave_pending",
      title: "Leave request to review",
      detail: `${who} — ${r.start_date} to ${r.end_date}`,
      href: "/dashboard/admin/leave-requests",
      at: r.created_at,
      tone: "act",
    });
  }
  for (const r of corrRes.data ?? []) {
    const who = (r.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "A team member";
    items.push({
      id: `corr-${r.id}`,
      kind: "correction_pending",
      title: "Attendance correction to review",
      detail: `${who} — ${r.date}`,
      href: "/dashboard/admin/attendance",
      at: r.created_at,
      tone: "act",
    });
  }
  for (const d of docsRes.data ?? []) {
    const svc = (d.orders as unknown as { service: string } | null)?.service ?? "an order";
    items.push({
      id: `odoc-${d.id}`,
      kind: "document_pending",
      title: "Document to verify",
      detail: `${d.file_name} — ${svc}`,
      href: "/dashboard/orders",
      at: d.created_at,
      tone: "act",
    });
  }
  for (const l of leadsRes.data ?? []) {
    items.push({
      id: `lead-${l.id}`,
      kind: "lead_unclaimed",
      title: "Unclaimed lead",
      detail: `${l.name}${l.service ? ` — ${l.service}` : ""}`,
      href: "/dashboard/admin/leads",
      at: l.created_at,
      tone: "watch",
    });
  }

  if (isAdmin || canSeeAllOrgs(profile)) {
    const acctQuery = supabase
      .from("account_requests")
      .select("id, full_name, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);
    if (!canSeeAllOrgs(profile)) acctQuery.eq("organization_id", orgId);

    const failQuery = supabase
      .from("email_failures")
      .select("id, email_type, recipient_email, created_at")
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(5);
    if (!canSeeAllOrgs(profile)) failQuery.eq("organization_id", orgId);

    const [acctRes, failRes] = await Promise.all([acctQuery, failQuery]);
    for (const a of acctRes.data ?? []) {
      items.push({
        id: `acct-${a.id}`,
        kind: "account_request",
        title: "Account request to review",
        detail: a.full_name ?? "New account request",
        href: "/dashboard/admin/account-requests",
        at: a.created_at,
        tone: "act",
      });
    }
    for (const f of failRes.data ?? []) {
      items.push({
        id: `mail-${f.id}`,
        kind: "email_failed",
        title: "Email didn't send",
        detail: `${f.email_type} → ${f.recipient_email}`,
        href: "/dashboard/admin/email-failures",
        at: f.created_at,
        tone: "watch",
      });
    }
  }

  if (profile.is_platform_admin) {
    const { data: crmReqs } = await supabase
      .from("org_access_requests")
      .select("id, organization_name, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);
    for (const r of crmReqs ?? []) {
      items.push({
        id: `crm-${r.id}`,
        kind: "crm_request",
        title: "CRM workspace request",
        detail: r.organization_name ?? "New workspace request",
        href: "/dashboard/platform/crm-requests",
        at: r.created_at,
        tone: "act",
      });
    }
  }

  return NextResponse.json({ items: sortItems(items) });
}

// Things blocking someone come first, then newest. Capped so the panel
// stays a to-do list rather than an inbox to scroll.
function sortItems(items: NotificationItem[]): NotificationItem[] {
  return items
    .sort((a, b) => {
      if (a.tone !== b.tone) return a.tone === "act" ? -1 : 1;
      return new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime();
    })
    .slice(0, 25);
}
