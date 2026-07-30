import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { LEAD_STAGES, type Lead, type LeadStage } from "@/lib/leads";

// MOCK STORE — writes to a local JSON file instead of a real database.
// Swap this for a Postgres insert once the backend/DB is wired up.
// On Vercel the project directory is read-only at runtime (only /tmp is
// writable), and /tmp there is wiped between deploys/cold starts — so
// leads won't persist in production, only within a single warm instance.
// That's an accepted limitation of the mock store, not a bug.
const MOCK_DATA_DIR = process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), "data");
const MOCK_LEADS_FILE = path.join(MOCK_DATA_DIR, "leads.mock.json");

async function readLeads(): Promise<Lead[]> {
  try {
    const raw = await fs.readFile(MOCK_LEADS_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<Lead>[];
    // backfill fields for leads saved before the CRM columns existed
    return parsed.map((l) => ({
      stage: "new",
      assignedTo: "Unassigned",
      notes: "",
      ...l,
    })) as Lead[];
  } catch {
    return [];
  }
}

async function writeLeads(leads: Lead[]) {
  await fs.mkdir(MOCK_DATA_DIR, { recursive: true });
  await fs.writeFile(MOCK_LEADS_FILE, JSON.stringify(leads, null, 2));
}

export async function GET() {
  const leads = await readLeads();
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

  const lead: Lead = {
    id: crypto.randomUUID(),
    name: String(name),
    email: String(email),
    phone: String(phone),
    city: city ? String(city) : undefined,
    state: state ? String(state) : "",
    service: service ? String(service) : undefined,
    plan: plan ? String(plan) : undefined,
    planPrice: planPrice ? String(planPrice) : undefined,
    message: message ? String(message) : undefined,
    createdAt: new Date().toISOString(),
    stage: "new",
    assignedTo: "Unassigned",
    notes: "",
  };

  const leads = await readLeads();
  leads.push(lead);
  await writeLeads(leads);

  return NextResponse.json({ ok: true, lead }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string") {
    return NextResponse.json({ error: "Lead id is required" }, { status: 400 });
  }

  const leads = await readLeads();
  const index = leads.findIndex((l) => l.id === body.id);
  if (index === -1) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const { stage, assignedTo, notes } = body as Record<string, unknown>;
  if (typeof stage === "string" && (LEAD_STAGES as readonly string[]).includes(stage)) {
    leads[index].stage = stage as LeadStage;
  }
  if (typeof assignedTo === "string") {
    leads[index].assignedTo = assignedTo;
  }
  if (typeof notes === "string") {
    leads[index].notes = notes;
  }

  await writeLeads(leads);
  return NextResponse.json({ ok: true, lead: leads[index] });
}
