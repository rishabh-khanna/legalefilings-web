import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { canManageStaff } from "@/lib/reporting-chain";

const BUCKET = "employee-documents";

// GET /api/employee-documents?staffId=... — a staff member always sees
// their own documents in full. Viewing someone else's requires being
// admin (sees everything, any visibility) or that person's manager
// (reporting chain) — and even then only documents that person marked
// "visible to manager", never their private ones.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const requestedStaffId = searchParams.get("staffId");
  const viewingOther = !!requestedStaffId && requestedStaffId !== profile.id;

  let staffId = profile.id;
  if (viewingOther) {
    const allowed = await canManageStaff(profile, requestedStaffId!);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    staffId = requestedStaffId!;
  }

  const supabase = getSupabaseAdmin();
  let query = supabase.from("employee_documents").select("*").eq("staff_id", staffId).order("uploaded_at", { ascending: false });
  if (viewingOther && profile.account_type !== "admin") {
    query = query.eq("visibility", "manager");
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data });
}

// POST /api/employee-documents — multipart upload. A staff member can
// upload their own documents (choosing whether to keep it private or
// share it with their manager); admin can upload on behalf of anyone via
// a staffId field, always as "private" (visibility is the owning
// employee's choice, not something set on their behalf).
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = form.get("file");
  const documentType = form.get("documentType");
  const requestedStaffId = form.get("staffId");
  const requestedVisibility = form.get("visibility");
  if (!(file instanceof File) || typeof documentType !== "string") {
    return NextResponse.json({ error: "file and documentType are required" }, { status: 400 });
  }
  const staffId = profile.account_type === "admin" && typeof requestedStaffId === "string" && requestedStaffId ? requestedStaffId : profile.id;
  const isOwnUpload = staffId === profile.id;
  const visibility = isOwnUpload && requestedVisibility === "manager" ? "manager" : "private";

  const supabase = getSupabaseAdmin();
  const path = `${staffId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await supabase
    .from("employee_documents")
    .insert({
      staff_id: staffId,
      document_type: documentType,
      file_path: path,
      file_name: file.name,
      uploaded_by: profile.id,
      visibility,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, document: data }, { status: 201 });
}
