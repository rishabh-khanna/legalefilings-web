import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canSeeAllOrgs } from "@/lib/organization";

type ActivityRow = {
  id: string;
  at: string;
  source: "invoice" | "order" | "lead" | "finance";
  action: string;
  detail: string;
  actor: string | null;
  href: string | null;
};

// GET /api/admin/activity — one readable timeline over the audit trails
// that were already being written and never read.
//
// invoice_events, order_status_history, lead_status_history and
// expense_audit_log have all existed for a while, and only invoice
// history had a viewer. "Who changed this, and when" was answerable
// only by someone willing to write SQL. This merges them.
//
// Each source is queried with its own limit and then merged and
// re-sorted in memory rather than attempted as one SQL union: they have
// genuinely different shapes and foreign keys, and a union view would
// have to be maintained in lockstep with four tables to save one round
// trip on an admin-only screen.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const supabase = getSupabaseAdmin();
  const orgScoped = !canSeeAllOrgs(profile);
  const PER_SOURCE = 100;

  const rows: ActivityRow[] = [];
  const want = (s: string) => !source || source === "all" || source === s;

  if (want("invoice")) {
    // invoice_events has no organization_id of its own — scope through
    // the invoice it belongs to.
    let q = supabase
      .from("invoice_events")
      .select("id, event_type, detail, created_at, invoices!inner(invoice_number, organization_id), profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(PER_SOURCE);
    if (orgScoped) q = q.eq("invoices.organization_id", profile.organization_id);
    const { data } = await q;
    for (const e of data ?? []) {
      const inv = e.invoices as unknown as { invoice_number: string } | null;
      rows.push({
        id: `inv-${e.id}`,
        at: e.created_at,
        source: "invoice",
        action: String(e.event_type).replace(/_/g, " "),
        detail: `${inv?.invoice_number ?? "Invoice"}${e.detail ? ` — ${e.detail}` : ""}`,
        actor: (e.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
        href: "/dashboard/invoice-crm",
      });
    }
  }

  if (want("order")) {
    let q = supabase
      .from("order_status_history")
      .select("id, old_status, new_status, note, changed_at, orders!inner(service, organization_id), profiles(full_name)")
      .order("changed_at", { ascending: false })
      .limit(PER_SOURCE);
    if (orgScoped) q = q.eq("orders.organization_id", profile.organization_id);
    const { data } = await q;
    for (const e of data ?? []) {
      const ord = e.orders as unknown as { service: string } | null;
      rows.push({
        id: `ord-${e.id}`,
        at: e.changed_at,
        source: "order",
        action: `${e.old_status ?? "new"} → ${e.new_status}`,
        detail: `${ord?.service ?? "Order"}${e.note ? ` — ${e.note}` : ""}`,
        actor: (e.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
        href: "/dashboard/orders",
      });
    }
  }

  if (want("lead")) {
    let q = supabase
      .from("lead_status_history")
      .select("id, old_status, new_status, changed_at, leads!inner(name, organization_id), profiles(full_name)")
      .order("changed_at", { ascending: false })
      .limit(PER_SOURCE);
    if (orgScoped) q = q.eq("leads.organization_id", profile.organization_id);
    const { data } = await q;
    for (const e of data ?? []) {
      const lead = e.leads as unknown as { name: string } | null;
      rows.push({
        id: `lead-${e.id}`,
        at: e.changed_at,
        source: "lead",
        action: `${e.old_status ?? "new"} → ${e.new_status}`,
        detail: lead?.name ?? "Lead",
        actor: (e.profiles as unknown as { full_name: string | null } | null)?.full_name ?? null,
        href: "/dashboard/admin/leads",
      });
    }
  }

  if (want("finance")) {
    let q = supabase
      .from("expense_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PER_SOURCE);
    if (orgScoped) q = q.eq("organization_id", profile.organization_id);
    const { data } = await q;
    for (const e of (data ?? []) as Record<string, unknown>[]) {
      rows.push({
        id: `fin-${e.id}`,
        at: e.created_at as string,
        source: "finance",
        action: String(e.action ?? "changed").replace(/_/g, " "),
        detail: String(e.entity_type ?? e.detail ?? "Business Finance"),
        actor: null,
        href: "/dashboard/finance/activity",
      });
    }
  }

  rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return NextResponse.json({ activity: rows.slice(0, 200) });
}
