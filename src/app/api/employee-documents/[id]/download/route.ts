import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { canManageStaff } from "@/lib/reporting-chain";

const BUCKET = "employee-documents";

// GET /api/employee-documents/[id]/download — the bucket is private, so
// this issues a short-lived signed URL and redirects to it rather than
// exposing a permanent public link to someone's Aadhaar/PAN scan. A
// manager can only reach a report's document this way if it was marked
// "visible to manager" — their reporting-chain access doesn't override
// someone's choice to keep a document private.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: doc, error } = await supabase.from("employee_documents").select("*").eq("id", id).single();
  if (error || !doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const isOwner = doc.staff_id === profile.id;
  const isAdmin = profile.account_type === "admin";
  const isManagerWithAccess = doc.visibility === "manager" && (await canManageStaff(profile, doc.staff_id));
  if (!isOwner && !isAdmin && !isManagerWithAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 60);
  if (signError || !signed) return NextResponse.json({ error: signError?.message ?? "Failed to sign URL" }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl);
}
