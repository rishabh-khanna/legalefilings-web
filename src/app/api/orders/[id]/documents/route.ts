import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { loadOrderForAccess } from "@/lib/organization";
import { validateUpload, DOCUMENT_UPLOAD_RULE } from "@/lib/upload-validation";
import { notifyDocumentsRequested, notifyDocumentsSubmitted } from "@/lib/order-document-notify";

const BUCKET = "order-documents";

// GET /api/orders/[id]/documents — the customer who owns the order, or
// staff/admin who can already reach that order (same rule as the orders
// list itself — org + reporting chain), see the same set of documents.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const order = await loadOrderForAccess(supabase, profile, id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("order_documents")
    .select("*, profiles!order_documents_uploaded_by_fkey(full_name)")
    .eq("order_id", id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ documentStatus: order.document_status, documents: data });
}

// POST /api/orders/[id]/documents — multipart upload. The owning
// customer uploads their own; staff/admin with access to the order can
// upload on their behalf (e.g. a scanned copy handed over by phone/in
// person). First upload against an "awaiting" order bumps it to
// "submitted" automatically — staff still has to actually verify it
// (see the PATCH routes), this just moves it out of the "nothing here
// yet" bucket.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const order = await loadOrderForAccess(supabase, profile, id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  const fileError = validateUpload(file, DOCUMENT_UPLOAD_RULE);
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

  const path = `${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await supabase
    .from("order_documents")
    .insert({
      order_id: id,
      organization_id: order.organization_id,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      uploaded_by: profile.id,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (order.document_status === "awaiting") {
    await supabase.from("orders").update({ document_status: "submitted" }).eq("id", id);
  }

  // Tell whoever is working this order that something arrived. Awaited
  // rather than fire-and-forget: a serverless function can be frozen the
  // moment the response is returned, which would drop the send.
  await notifyDocumentsSubmitted(supabase, order, file.name, profile.id);

  return NextResponse.json({ ok: true, document: data }, { status: 201 });
}

// PATCH /api/orders/[id]/documents — staff/admin only, order-level.
// Lets staff opt an order out of document collection entirely ("this
// engagement doesn't need any"), confirm everything's in order once
// they've reviewed each file, or send it back to "awaiting" to ask the
// customer for more/better documents.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile || profile.account_type === "customer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const order = await loadOrderForAccess(supabase, profile, id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const documentStatus = body?.documentStatus;
  if (!["awaiting", "verified", "not_required"].includes(documentStatus)) {
    return NextResponse.json({ error: "documentStatus must be 'awaiting', 'verified', or 'not_required'" }, { status: 400 });
  }

  const { data, error } = await supabase.from("orders").update({ document_status: documentStatus }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Asking for paperwork is the one transition the customer has to act
  // on, and nothing told them before — an order could sit in "Documents
  // Needed" indefinitely with the customer entirely unaware. Only fires
  // on the actual transition INTO awaiting, so re-saving the same status
  // doesn't re-nag them.
  if (documentStatus === "awaiting" && order.document_status !== "awaiting") {
    await notifyDocumentsRequested(supabase, order);
  }

  // "Mark all verified" used to only flip this order-level badge, leaving
  // any individual document still sitting at 'pending' underneath it —
  // an order could read "Documents Verified" with zero documents actually
  // reviewed. Bulk-verify every not-yet-decided document along with it;
  // a document staff already explicitly rejected stays rejected rather
  // than being silently overridden by the bulk action.
  if (documentStatus === "verified") {
    await supabase.from("order_documents").update({ status: "verified" }).eq("order_id", id).eq("status", "pending");
  }

  return NextResponse.json({ ok: true, order: data });
}
