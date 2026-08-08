import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { canManageStaff } from "@/lib/reporting-chain";
import { canSeeAllOrgs } from "@/lib/organization";
import { validateUpload, DOCUMENT_UPLOAD_RULE } from "@/lib/upload-validation";

const BUCKET = "employee-documents";

// GET /api/employee-documents?staffId=... — a staff member sees their
// own; a leader/group_leader can pass ?staffId= for anyone in their
// reporting chain; admin can pass it for anyone. Same "who can see whom"
// rule already used for attendance/leave — hierarchy-based, not opt-in.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const requestedStaffId = searchParams.get("staffId");
  let staffId = profile.id;
  if (requestedStaffId && requestedStaffId !== profile.id) {
    if (!(await canManageStaff(profile, requestedStaffId))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    staffId = requestedStaffId;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("employee_documents")
    .select("*")
    .eq("staff_id", staffId)
    .order("uploaded_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ documents: data });
}

// POST /api/employee-documents — multipart upload. A staff member can
// upload their own documents; admin can upload on behalf of anyone via
// a staffId field.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = form.get("file");
  const documentType = form.get("documentType");
  const requestedStaffId = form.get("staffId");
  if (!(file instanceof File) || typeof documentType !== "string") {
    return NextResponse.json({ error: "file and documentType are required" }, { status: 400 });
  }
  const fileError = validateUpload(file, DOCUMENT_UPLOAD_RULE);
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 });
  const staffId = profile.account_type === "admin" && typeof requestedStaffId === "string" && requestedStaffId ? requestedStaffId : profile.id;

  const supabase = getSupabaseAdmin();
  let staffOrgId = profile.organization_id;
  if (staffId !== profile.id) {
    const { data: targetStaff } = await supabase.from("profiles").select("organization_id").eq("id", staffId).single();
    if (!targetStaff || (!canSeeAllOrgs(profile) && targetStaff.organization_id !== profile.organization_id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    staffOrgId = targetStaff.organization_id;
  }
  const path = `${staffId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
    contentType: file.type || "application/octet-stream",
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data, error } = await supabase
    .from("employee_documents")
    .insert({
      organization_id: staffOrgId,
      staff_id: staffId,
      document_type: documentType,
      file_path: path,
      file_name: file.name,
      uploaded_by: profile.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, document: data }, { status: 201 });
}
