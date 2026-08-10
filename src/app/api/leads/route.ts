import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { sendLeadAcknowledgementEmail } from "@/lib/email";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { canSeeAllOrgs } from "@/lib/organization";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import { hasToolAccess } from "@/lib/tool-grants";
import { LEAD_STAGES, type Lead, type LeadStage } from "@/lib/leads";

// DB rows are snake_case; the frontend (admin CRM board, consultation form)
// speaks the camelCase `Lead` shape — translate at the boundary rather than
// changing either side to match the other.
type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string | null;
  state: string | null;
  service: string | null;
  plan: string | null;
  plan_price: string | null;
  message: string | null;
  status: LeadStage;
  assigned_to: string | null;
  notes: string;
  created_at: string;
  converted_to_profile_id: string | null;
  assignee?: { full_name: string | null } | null;
};

// assigned_to is a profiles FK (see 20260829000000) — NULL is the one
// and only representation of "unclaimed". "Unassigned" is a display
// label applied here for the UI and never a stored value; the earlier
// text-column design had both, and rows written under one convention
// were unreachable by code written against the other.
function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    city: row.city ?? undefined,
    state: row.state ?? "",
    service: row.service ?? undefined,
    plan: row.plan ?? undefined,
    planPrice: row.plan_price ?? undefined,
    message: row.message ?? undefined,
    createdAt: row.created_at,
    stage: row.status,
    assignedToId: row.assigned_to ?? undefined,
    assignedTo: row.assignee?.full_name ?? "Unassigned",
    notes: row.notes,
    convertedToProfileId: row.converted_to_profile_id ?? undefined,
  };
}

const LEAD_SELECT = "*, assignee:profiles!leads_assigned_to_fkey(full_name)";

// The staff a viewer is allowed to see leads for: themselves plus their
// reporting chain. Returned as ids — scoping used to compare display
// names, which broke the moment anyone renamed themselves and would
// have leaked leads between two staff who happened to share a name.
async function visibleAssigneeIds(profile: { id: string }): Promise<string[]> {
  return [profile.id, ...(await getReportingChainIds(profile.id))];
}

// GET — staff/admin only. A rater sees leads assigned to them plus the
// shared unclaimed pool; a leader/group_leader additionally sees their
// reporting chain's; admin sees everything. Scoping is by profile id
// (leads.assigned_to is a profiles FK again as of 20260829000000) — it
// compared display names before, which silently orphaned a staff
// member's whole pipeline the moment they renamed themselves.
export async function GET() {
  const profile = await getCurrentProfile();
  // A customer delegated the leads_crm tool (see staff_tool_grants) is
  // the one exception to "customer never sees this" — they're operating
  // their own org's pipeline, not just their own purchases.
  const isCustomerOperator = profile?.account_type === "customer" && (await hasToolAccess(profile, "leads_crm"));
  if (!profile || (profile.account_type === "customer" && !isCustomerOperator)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  let query = supabase.from("leads").select(LEAD_SELECT).order("created_at", { ascending: false });

  if (!canSeeAllOrgs(profile)) {
    query = query.eq("organization_id", profile.organization_id);
  }
  // canSeeAllOrgs (is_platform_admin) must also skip the
  // assignee-narrowing below — independent axis from account_type, so a
  // platform_admin without account_type "admin" would otherwise pass the
  // org filter above (every org) and then get wrongly narrowed straight
  // back down to their own name/chain here. A customer-operator has no
  // reporting chain of their own either (customers are never in anyone's
  // reports_to), so they get the same unrestricted org-wide view admin
  // gets, not narrowed down to an empty chain.
  if (profile.account_type !== "admin" && !canSeeAllOrgs(profile) && !isCustomerOperator) {
    // assigned_to.is.null is what surfaces the shared unclaimed pool.
    // Postgres IN never matches NULL, so the previous `.in(...)` alone
    // hid every unclaimed lead from exactly the raters and leaders the
    // claim flow exists for — only admins (who skip this filter) could
    // see them. Same NULL-vs-IN bug already fixed in the orders and
    // invoices lists.
    const ids = await visibleAssigneeIds(profile);
    query = query.or(`assigned_to.is.null,assigned_to.in.(${ids.join(",")})`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const leads = (data as LeadRow[]).map(toLead);
  return NextResponse.json({ leads, count: leads.length });
}

// POST — two callers share this route:
//   - Public, unauthenticated (no session): legalefilings.com's own
//     consultation form — always lands in Legal Efilings' own org (a
//     tenant org getting its own public-facing lead capture is a
//     separate, later feature, not something this endpoint decides
//     between).
//   - Signed-in staff/admin: manually adding a lead from their own CRM
//     (see /dashboard/crm) — lands in their own org, pre-assigned to them.
export async function POST(request: Request) {
  // Unauthenticated on the public path: this inserts a lead AND emails
  // the address supplied in the body. Without a limit that is both a
  // way to flood every staff member's CRM with junk and, worse, an open
  // relay — an attacker could have this domain send mail to any address
  // they like, burning the sending reputation and the Brevo quota.
  // Signed-in staff adding leads by hand are exempt; the abuse case is
  // the anonymous one.
  const profile = await getCurrentProfile();
  if (!profile && isRateLimited(`lead:${getClientIp(request)}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many submissions. Please try again in a few minutes." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, email, phone, city, state, service, plan, planPrice, message, company, orgSlug } = body as Record<string, unknown>;

  if (!name || !email || !phone) {
    return NextResponse.json(
      { error: "Name, email, and phone are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  let organizationId: string | undefined;
  let assignedTo: string | null = null;
  let source: string | undefined;
  let orgName: string | undefined;
  const isCustomerOperator = profile?.account_type === "customer" && (await hasToolAccess(profile, "leads_crm"));
  if (profile && (profile.account_type !== "customer" || isCustomerOperator)) {
    organizationId = profile.organization_id;
    assignedTo = profile.id;
    source = "crm_manual";
  } else {
    // A tenant org's own public lead-capture page (/org/[slug]) passes its
    // slug through so the lead lands in that org instead of Legal
    // Efilings' — falls back to Legal Efilings for the main site's own
    // consultation form (no slug) or an invalid/suspended slug, rather
    // than rejecting the submission outright over a bad or stale link.
    let org: { id: string; name: string } | null = null;
    if (typeof orgSlug === "string" && orgSlug) {
      const { data } = await supabase.from("organizations").select("id, name").eq("slug", orgSlug).eq("status", "active").maybeSingle();
      org = data;
    }
    if (!org) {
      const { data } = await supabase.from("organizations").select("id, name").eq("slug", "legal-efilings").single();
      org = data;
    }
    organizationId = org?.id;
    orgName = org?.name;
  }

  const { data, error } = await supabase
    .from("leads")
    .insert({
      organization_id: organizationId,
      name: String(name),
      email: String(email),
      phone: String(phone),
      city: city ? String(city) : null,
      state: state ? String(state) : null,
      company: company ? String(company) : null,
      service: service ? String(service) : null,
      plan: plan ? String(plan) : null,
      plan_price: planPrice ? String(planPrice) : null,
      message: message ? String(message) : null,
      ...(assignedTo ? { assigned_to: assignedTo } : {}),
      ...(source ? { source } : {}),
    })
    .select(LEAD_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const lead = toLead(data as LeadRow);

  // Staff manually adding a lead already knows about it — the
  // acknowledgment email is for the public consultation-form path only.
  if (profile) {
    return NextResponse.json({ ok: true, lead }, { status: 201 });
  }

  // Best-effort: a failed acknowledgment email shouldn't fail the lead
  // submission itself — the lead is already saved by this point.
  try {
    await sendLeadAcknowledgementEmail({ ...lead, orgName });
  } catch (err) {
    console.error("Failed to send lead acknowledgement email:", err);
  }

  return NextResponse.json({ ok: true, lead }, { status: 201 });
}

// PATCH — staff/admin only, and only on a lead already visible to them
// (same scoping as GET) — a rater can update their own leads' stage/notes
// or claim an unassigned one, but can't reach into another team's lead by
// id. `claim: true` does an atomic "first to ask wins" assignment: it only
// succeeds if the lead was still Unassigned at the moment of the update,
// so two people racing to grab the same lead can't both end up owning it.
export async function PATCH(request: Request) {
  const profile = await getCurrentProfile();
  const isCustomerOperator = profile?.account_type === "customer" && (await hasToolAccess(profile, "leads_crm"));
  if (!profile || (profile.account_type === "customer" && !isCustomerOperator)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "Lead id is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: leadForOrgCheck } = await supabase.from("leads").select("organization_id").eq("id", body.id).single();
  if (!leadForOrgCheck) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!canSeeAllOrgs(profile) && leadForOrgCheck.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (body.claim === true) {
    // NULL is the only "unclaimed" state now (see 20260829000000), so
    // this is a straight atomic first-to-ask-wins: the update only
    // matches while the lead is still unclaimed, and a loser gets zero
    // rows rather than silently stealing an owned lead.
    const { data, error } = await supabase
      .from("leads")
      .update({ assigned_to: profile.id })
      .eq("id", body.id)
      .is("assigned_to", null)
      .select(LEAD_SELECT)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "This lead was already claimed by someone else" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, lead: toLead(data as LeadRow) });
  }

  if (profile.account_type !== "admin" && !canSeeAllOrgs(profile) && !isCustomerOperator) {
    const { data: existing } = await supabase.from("leads").select("assigned_to").eq("id", body.id).single();
    if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    // An unclaimed lead (NULL) is editable by anyone who can see the
    // shared pool — claiming it is the normal path, but stage/notes
    // edits on it shouldn't 403 either.
    const visibleIds = await visibleAssigneeIds(profile);
    if (existing.assigned_to && !visibleIds.includes(existing.assigned_to)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { stage, assignedToId, notes } = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  let previousStage: string | null = null;
  if (typeof stage === "string" && (LEAD_STAGES as readonly string[]).includes(stage)) {
    const { data: existing } = await supabase.from("leads").select("status").eq("id", body.id).single();
    previousStage = existing?.status ?? null;
    patch.status = stage;
  }
  // assignedToId is a profile id, or null to return the lead to the
  // shared unclaimed pool. Validated against who the caller is actually
  // allowed to hand work to — an admin can pick anyone in their own org,
  // anyone else only themselves or their reporting chain.
  if (assignedToId === null || typeof assignedToId === "string") {
    if (assignedToId === null) {
      patch.assigned_to = null;
    } else {
      let validIds: string[];
      if (profile.account_type === "admin" || canSeeAllOrgs(profile) || isCustomerOperator) {
        let staffQuery = supabase.from("profiles").select("id").in("account_type", ["staff", "admin"]);
        if (!canSeeAllOrgs(profile)) staffQuery = staffQuery.eq("organization_id", leadForOrgCheck.organization_id);
        const { data: staffProfiles } = await staffQuery;
        validIds = (staffProfiles ?? []).map((p) => p.id);
      } else {
        validIds = await visibleAssigneeIds(profile);
      }
      if (!validIds.includes(assignedToId)) {
        return NextResponse.json({ error: "Not a valid staff member to assign this lead to" }, { status: 400 });
      }
      patch.assigned_to = assignedToId;
    }
  }
  if (typeof notes === "string") {
    patch.notes = notes;
  }

  const { data, error } = await supabase.from("leads").update(patch).eq("id", body.id).select(LEAD_SELECT).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Real audit trail for the pipeline's activity timeline — only logged
  // when the stage actually changed (not on every notes/assignment edit).
  if (typeof stage === "string" && previousStage !== stage) {
    await supabase.from("lead_status_history").insert({
      lead_id: body.id,
      old_status: previousStage,
      new_status: stage,
      changed_by: profile.id,
    });
  }

  return NextResponse.json({ ok: true, lead: toLead(data as LeadRow) });
}
