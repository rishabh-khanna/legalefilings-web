import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";

const BUCKET = "invoice-attachments";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const { id, attachmentId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const [{ data: invoice }, { data: attachment }] = await Promise.all([
    supabase.from("invoices").select("created_by, customer_id, organization_id").eq("id", id).single(),
    supabase.from("invoice_attachments").select("*").eq("id", attachmentId).eq("invoice_id", id).single(),
  ]);
  if (!invoice || !attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwnInvoice = invoice.customer_id === profile.id;
  if (!isOwnInvoice) {
    if (!isStaffOrAdmin(profile)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!canSeeAllOrgs(profile) && invoice.organization_id !== profile.organization_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (profile.account_type !== "admin" && !canSeeAllOrgs(profile)) {
      const chain = await getReportingChainIds(profile.id);
      if (!invoice.created_by || ![profile.id, ...chain].includes(invoice.created_by)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrl(attachment.file_path, 60);
  if (error || !signed) return NextResponse.json({ error: error?.message ?? "Failed to sign URL" }, { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
