import type { Profile } from "@/lib/roles";
import { getReportingChainIds } from "@/lib/reporting-chain";
import type { getSupabaseAdmin } from "@/lib/supabase-admin";

// Every real read/write in this app goes through an API route using the
// service-role key (bypasses RLS entirely), so THIS is where org
// isolation is actually enforced — the RLS policies (see migration
// 20260808000000) are the secondary backstop for the much rarer direct
// browser-session query, and both layers need to agree.
//
// The rule, everywhere: a platform_admin (Legal-Efilings-operator-only)
// sees across every organization; everyone else — including an org's
// own `admin` — only ever sees their own organization_id, full stop.
// This is deliberately a single, tiny, reused function rather than
// letting each route re-derive "should I filter by org" its own way,
// which is exactly how a cross-tenant leak creeps in one route at a time.
export function canSeeAllOrgs(profile: Pick<Profile, "is_platform_admin">): boolean {
  return profile.is_platform_admin;
}

// CRM access for a tenant org is time-boxed (bundled free with a plan
// purchase, not a lifetime grant — see Phase 4, org_access_requests) —
// null means no expiry set (Legal Efilings' own "internal" org, and any
// org a platform_admin hand-provisions without setting one).
// A suspended org is cut off regardless of its expiry date — status is
// the deliberate operator lever ("stop serving this tenant now"),
// access_expires_at is the automatic one. Suspension used to be purely
// decorative: `status` existed on the row and in the Organizations table
// UI, but nothing anywhere ever read it, so suspending a tenant did
// nothing at all.
export function isOrgAccessActive(org: { access_expires_at: string | null; status?: string | null }): boolean {
  if (org.status === "suspended") return false;
  return !org.access_expires_at || new Date(org.access_expires_at) > new Date();
}

// The exact "can this staff/admin reach this invoice" check repeats
// across every invoice sub-route (mark-paid, record-payment, send,
// send-email, history, attachments...) — centralized so a future
// change to the rule (or a route that forgets the org half of it)
// isn't a silent per-route bug. Returns null (not throwing) when
// forbidden/not-found so each route can pick its own status code/message.
export async function loadInvoiceForStaffAccess(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  profile: Pick<Profile, "id" | "account_type" | "organization_id" | "is_platform_admin">,
  invoiceId: string
): Promise<Record<string, unknown> | null> {
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
  if (!invoice) return null;
  if (!canSeeAllOrgs(profile) && invoice.organization_id !== profile.organization_id) return null;
  // canSeeAllOrgs (is_platform_admin) is its own independent axis from
  // account_type — a platform_admin doesn't necessarily have
  // account_type "admin" (see docs/ROLE_ACCESS_MATRIX.md). Without this,
  // a platform_admin whose account_type is e.g. "staff" would pass the
  // org check above (correctly, across every org) and then immediately
  // get wrongly narrowed back down to just their own reporting chain by
  // this second check — silently defeating the cross-org access the
  // first check just granted.
  if (profile.account_type !== "admin" && !canSeeAllOrgs(profile)) {
    const chain = await getReportingChainIds(profile.id);
    const createdBy = invoice.created_by as string | null;
    if (!createdBy || ![profile.id, ...chain].includes(createdBy)) return null;
  }
  return invoice;
}

// Same shape of check as loadInvoiceForStaffAccess, but for orders — and
// unlike an invoice, an order also has a real customer on the other end
// who needs to reach their own order's documents, not just staff/admin.
// An unassigned order (assigned_to null) stays visible to any staff
// level in-org, matching the existing "staff read org orders" RLS policy
// (see migration 20260808000000) rather than hiding it from everyone
// until an admin claims it.
export async function loadOrderForAccess(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  profile: Pick<Profile, "id" | "account_type" | "organization_id" | "is_platform_admin">,
  orderId: string
): Promise<Record<string, unknown> | null> {
  const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
  if (!order) return null;

  if (profile.account_type === "customer") {
    return order.customer_id === profile.id ? order : null;
  }

  if (!canSeeAllOrgs(profile) && order.organization_id !== profile.organization_id) return null;
  // Same reasoning as loadInvoiceForStaffAccess above: canSeeAllOrgs
  // (is_platform_admin) must also exempt from the reporting-chain
  // narrowing below, not just account_type === "admin" — the two are
  // independent axes, and a platform_admin without account_type "admin"
  // would otherwise pass the org check and then get wrongly narrowed
  // back down to their own chain.
  if (profile.account_type !== "admin" && !canSeeAllOrgs(profile)) {
    const assignedTo = order.assigned_to as string | null;
    if (assignedTo) {
      const chain = await getReportingChainIds(profile.id);
      if (![profile.id, ...chain].includes(assignedTo)) return null;
    }
  }
  return order;
}
