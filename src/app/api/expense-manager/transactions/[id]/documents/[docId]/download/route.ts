import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBookAccess, hasPermission } from "@/lib/expense-manager";

const BUCKET = "expense-documents";

// GET .../documents/[docId]/download — private bucket, short-lived
// signed URL, same pattern as every other document download route in
// this app.
export async function GET(request: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: tx } = await supabase.from("expense_transactions").select("customer_id").eq("id", id).single();
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const access = await getBookAccess(supabase, profile.id, tx.customer_id);
  if (!access || !hasPermission(access, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: doc } = await supabase.from("expense_documents").select("file_path").eq("id", docId).eq("transaction_id", id).single();
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 60);
  if (error || !signed) return NextResponse.json({ error: error?.message ?? "Failed to sign URL" }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl);
}
