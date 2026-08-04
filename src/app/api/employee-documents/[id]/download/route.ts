import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canManageStaff } from "@/lib/reporting-chain";

const BUCKET = "employee-documents";

// GET /api/employee-documents/[id]/download — the bucket is private, so
// this issues a short-lived signed URL and redirects to it rather than
// exposing a permanent public link to someone's Aadhaar/PAN scan. Same
// hierarchy rule as the list endpoint: owner, their manager chain, or
// admin.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: doc, error } = await supabase.from("employee_documents").select("*").eq("id", id).single();
  if (error || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (!(await canManageStaff(profile, doc.staff_id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 60);
  if (signError || !signed) return NextResponse.json({ error: signError?.message ?? "Failed to sign URL" }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl);
}
