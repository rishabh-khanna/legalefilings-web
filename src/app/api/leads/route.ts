import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendLeadAcknowledgementEmail } from "@/lib/email";
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

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const leads = (data as LeadRow[]).map(toLead);
  return NextResponse.json({ leads, count: leads.length });
}

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

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "Lead id is required" }, { status: 400 });
  }

  const { stage, assignedTo, notes } = body as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof stage === "string" && (LEAD_STAGES as readonly string[]).includes(stage)) {
    patch.status = stage;
  }
  if (typeof assignedTo === "string") {
    patch.assigned_to = assignedTo;
  }
  if (typeof notes === "string") {
    patch.notes = notes;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("leads").update(patch).eq("id", body.id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  return NextResponse.json({ ok: true, lead: toLead(data as LeadRow) });
}
