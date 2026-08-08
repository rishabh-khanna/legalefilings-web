import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBookAccess, hasPermission } from "@/lib/expense-manager";

// PATCH /api/expense-manager/recurring/[id] — pause/resume, or edit the
// amount for next time (e.g. rent went up).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("expense_recurring_templates").select("book_owner_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const access = await getBookAccess(supabase, profile.id, existing.book_owner_id);
  if (!access || !hasPermission(access, "manage_accounts")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  const { amount, isActive, description } = body as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if (typeof amount === "number" && amount > 0) patch.amount = amount;
  if (typeof isActive === "boolean") patch.is_active = isActive;
  if (typeof description === "string") patch.description = description || null;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

  const { data, error } = await supabase.from("expense_recurring_templates").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, template: data });
}

// DELETE /api/expense-manager/recurring/[id] — stops it for good (past
// transactions it already generated stay exactly as they are; this only
// removes the template).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase.from("expense_recurring_templates").select("book_owner_id").eq("id", id).single();
  if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const access = await getBookAccess(supabase, profile.id, existing.book_owner_id);
  if (!access || !hasPermission(access, "manage_accounts")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase.from("expense_recurring_templates").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
