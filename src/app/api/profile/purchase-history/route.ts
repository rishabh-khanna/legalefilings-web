import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";

// GET /api/profile/purchase-history — any signed-in user, deliberately
// unscoped by organization_id (the one place in the app that's correct):
// everywhere else, an admin's queries are scoped to their own org because
// they're looking at their org's book of business. This is different —
// it's "what did I, this specific person, ever buy," which by definition
// can span an org boundary the caller has since moved past.
//
// This exists because of the "CRM Access" promotion flow (see
// /api/platform/crm-access-requests/[id]): approving it flips a paid
// customer's account_type from "customer" to "admin" of a brand-new org,
// on the same login. Their original plan-purchase order and invoice —
// the very thing that qualified them for CRM access — still belong to
// the OLD org (Legal Efilings), so every other page's org-scoped query
// (Order History, My Invoices) stops finding them the moment the
// promotion happens: not deleted, just permanently unreachable through
// normal nav. customer_id is a stable identity independent of whichever
// org the profile currently belongs to, so filtering by it alone is what
// makes this findable again — safe to leave unscoped precisely because
// it's always the caller's own id, never anyone else's.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();

  const [{ data: orders, error: ordersError }, { data: invoices, error: invoicesError }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, service, plan, plan_price, status, created_at, organization_id, organizations(name)")
      .eq("customer_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, invoice_number, total, status, created_at, organization_id, organizations(name)")
      .eq("customer_id", profile.id)
      .order("created_at", { ascending: false }),
  ]);

  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });
  if (invoicesError) return NextResponse.json({ error: invoicesError.message }, { status: 500 });

  return NextResponse.json({ orders: orders ?? [], invoices: invoices ?? [] });
}
