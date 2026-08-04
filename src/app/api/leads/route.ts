import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { sendLeadAcknowledgementEmail } from "@/lib/email";
import { getReportingChainIds } from "@/lib/reporting-chain";
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
};

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
    assignedTo: row.assigned_to ?? "Unassigned",
    notes: row.notes,
  };
}

// The names a viewer is allowed to see leads for: themselves, their
// reporting chain, and the shared "Unassigned" pool — new leads have to
// be visible to everyone relevant so anyone can claim one, not just
// whoever an admin happens to assign it to.
async function visibleAssigneeNames(profile: { id: string; full_name: string | null }): Promise<string[]> {
  const supabase = getSupabaseAdmin();
  const chainIds = await getReportingChainIds(profile.id);
  const namesResult = chainIds.length > 0
    ? await supabase.from("profiles").select("full_name").in("id", chainIds)
    : { data: [] as { full_name: string | null }[] };
  return [profile.full_name, "Unassigned", ...(namesResult.data ?? []).map((p) => p.full_name)].filter(
    (n): n is string => Boolean(n)
  );
}

// GET — staff/admin only. A rater sees leads assigned to them plus the
// shared unclaimed pool; a leader/group_leader additionally sees their
// reporting chain's; admin sees everything. leads.assigned_to is a
// free-text staff name (see migration 20260730195500 — no real staff
// accounts existed when that column was first used), so scoping matches
// by name, not id.
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  let query = supabase.from("leads").select("*").order("created_at", { ascending: false });

  if (profile.account_type !== "admin") {
    query = query.in("assigned_to", await visibleAssigneeNames(profile));
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const leads = (data as LeadRow[]).map(toLead);
  return NextResponse.json({ leads, count: leads.length });
}

// POST — the public consultation form; deliberately no auth requirement.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { name, email, phone, city, state, service, plan, planPrice, message } = body as Record<string, unknown>;

  if (!name || !email || !phone) {
    return NextResponse.json(
      { error: "Name, email, and phone are required" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("leads")
    .insert({
      name: String(name),
      email: String(email),
      phone: String(phone),
      city: city ? String(city) : null,
      state: state ? String(state) : null,
      service: service ? String(service) : null,
      plan: plan ? String(plan) : null,
      plan_price: planPrice ? String(planPrice) : null,
      message: message ? String(message) : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const lead = toLead(data as LeadRow);

  // Best-effort: a failed acknowledgment email shouldn't fail the lead
  // submission itself — the lead is already saved by this point.
  try {
    await sendLeadAcknowledgementEmail(lead);
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
  if (!profile || profile.account_type === "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "Lead id is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  if (body.claim === true) {
    if (!profile.full_name) return NextResponse.json({ error: "Your profile has no name set" }, { status: 400 });
    const { data, error } = await supabase
      .from("leads")
      .update({ assigned_to: profile.full_name })
      .eq("id", body.id)
      .eq("assigned_to", "Unassigned")
      .select()
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "This lead was already claimed by someone else" }, { status: 409 });
    }
    return NextResponse.json({ ok: true, lead: toLead(data as LeadRow) });
  }

  if (profile.account_type !== "admin") {
    const { data: existing } = await supabase.from("leads").select("assigned_to").eq("id", body.id).single();
    if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    const visibleNames = await visibleAssigneeNames(profile);
    if (!existing.assigned_to || !visibleNames.includes(existing.assigned_to)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { stage, assignedTo, notes } = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  let previousStage: string | null = null;
  if (typeof stage === "string" && (LEAD_STAGES as readonly string[]).includes(stage)) {
    const { data: existing } = await supabase.from("leads").select("status").eq("id", body.id).single();
    previousStage = existing?.status ?? null;
    patch.status = stage;
  }
  if (typeof assignedTo === "string") {
    patch.assigned_to = assignedTo;
  }
  if (typeof notes === "string") {
    patch.notes = notes;
  }

  const { data, error } = await supabase.from("leads").update(patch).eq("id", body.id).select().single();

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
