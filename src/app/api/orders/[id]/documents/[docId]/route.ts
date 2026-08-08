import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { loadOrderForAccess } from "@/lib/organization";

const BUCKET = "order-documents";

// PATCH /api/orders/[id]/documents/[docId] — staff/admin only. Reviews
// one specific file — verify it, or reject it with a note (e.g. "blurry,
// please reupload") so the customer knows exactly what's wrong instead
// of just seeing the order stuck.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const order = await loadOrderForAccess(supabase, profile, id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (status !== "verified" && status !== "rejected") {
    return NextResponse.json({ error: "status must be 'verified' or 'rejected'" }, { status: 400 });
  }
  const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote : null;

  const { data, error } = await supabase
    .from("order_documents")
    .update({ status, review_note: reviewNote })
    .eq("id", docId)
    .eq("order_id", id)
    .select()
    .single();
  if (error || !data) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  return NextResponse.json({ ok: true, document: data });
}

// DELETE /api/orders/[id]/documents/[docId] — the uploader (customer or
// staff) can remove a document they added, e.g. after uploading the
// wrong file by mistake; staff/admin can also remove any of their own
// org's. Storage delete is best-effort — a leftover blob after a failed
// storage call isn't worth failing the whole request over, the DB row
// (the thing everything else actually reads) is already gone either way.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const order = await loadOrderForAccess(supabase, profile, id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { data: doc } = await supabase.from("order_documents").select("*").eq("id", docId).eq("order_id", id).single();
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (profile.account_type === "customer" && doc.uploaded_by !== profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await supabase.storage.from(BUCKET).remove([doc.file_path]);
  const { error } = await supabase.from("order_documents").delete().eq("id", docId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
