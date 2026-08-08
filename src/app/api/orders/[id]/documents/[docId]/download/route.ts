import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { loadOrderForAccess } from "@/lib/organization";

const BUCKET = "order-documents";

// GET /api/orders/[id]/documents/[docId]/download — the bucket is
// private, so this issues a short-lived signed URL and redirects to it
// rather than exposing a permanent public link to someone's PAN/Aadhaar
// scan. Same access rule as the list endpoint.
export async function GET(request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const order = await loadOrderForAccess(supabase, profile, id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const { data: doc } = await supabase.from("order_documents").select("file_path").eq("id", docId).eq("order_id", id).single();
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 60);
  if (error || !signed) return NextResponse.json({ error: error?.message ?? "Failed to sign URL" }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl);
}
