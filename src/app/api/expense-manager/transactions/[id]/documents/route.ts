import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBookAccess, hasPermission } from "@/lib/expense-manager";
import { validateUpload, DOCUMENT_UPLOAD_RULE } from "@/lib/upload-validation";

const BUCKET = "expense-documents";

// GET /api/expense-manager/transactions/[id]/documents — list.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: tx } = await supabase.from("expense_transactions").select("customer_id").eq("id", id).single();
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const access = await getBookAccess(supabase, profile.id, tx.customer_id);
  if (!access || !hasPermission(access, "view_reports")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase.from("expense_documents").select("*").eq("transaction_id", id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data });
}

// POST /api/expense-manager/transactions/[id]/documents — multipart
// upload (Module 7 — invoice/receipt/bill attachments per transaction).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: tx } = await supabase.from("expense_transactions").select("customer_id, organization_id").eq("id", id).single();
  if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });

  const access = await getBookAccess(supabase, profile.id, tx.customer_id);
  if (!access || !hasPermission(access, "add_expense")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  const fileError = validateUpload(file, DOCUMENT_UPLOAD_RULE);
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

  const path = `${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, { contentType: file.type || "application/octet-stream" });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await supabase
    .from("expense_documents")
    .insert({ transaction_id: id, organization_id: tx.organization_id, file_name: file.name, file_path: path, file_size: file.size, uploaded_by: profile.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, document: data }, { status: 201 });
}
