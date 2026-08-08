import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { isStaffOrAdmin, type Profile } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";
import { validateUpload, DOCUMENT_UPLOAD_RULE } from "@/lib/upload-validation";

const BUCKET = "invoice-attachments";

async function canAccessInvoice(profile: Pick<Profile, "id" | "account_type" | "organization_id" | "is_platform_admin">, invoiceId: string) {
  const supabase = getSupabaseAdmin();
  const { data: invoice } = await supabase.from("invoices").select("created_by, customer_id, organization_id").eq("id", invoiceId).single();
  if (!invoice) return false;
  if (invoice.customer_id === profile.id) return true;
  if (!isStaffOrAdmin(profile)) return false;
  if (!canSeeAllOrgs(profile) && invoice.organization_id !== profile.organization_id) return false;
  if (profile.account_type === "admin") return true;
  const chain = await getReportingChainIds(profile.id);
  return !!invoice.created_by && [profile.id, ...chain].includes(invoice.created_by);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canAccessInvoice(profile, id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("invoice_attachments").select("*").eq("invoice_id", id).order("uploaded_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attachments: data });
}

// POST — work orders, purchase orders, agreements, supporting documents.
// Staff/admin only (a customer can view an invoice's attachments but
// doesn't attach documents to their own invoice).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!(await canAccessInvoice(profile, id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  const fileError = validateUpload(file, DOCUMENT_UPLOAD_RULE);
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const path = `${id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await supabase
    .from("invoice_attachments")
    .insert({ invoice_id: id, file_name: file.name, file_path: path, uploaded_by: profile.id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, attachment: data }, { status: 201 });
}
