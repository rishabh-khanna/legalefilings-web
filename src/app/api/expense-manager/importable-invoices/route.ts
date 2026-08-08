import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getBookAccess, hasPermission } from "@/lib/expense-manager";

// GET /api/expense-manager/importable-invoices?bookOwnerId=... — every
// paid invoice this customer already owes/paid Legal Efilings or a
// tenant org for (professional fees, filings...) that hasn't already
// been imported into their Business Finance books as an expense. A real
// business cost they'd otherwise have to re-type by hand from a PDF.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const bookOwnerId = searchParams.get("bookOwnerId") || profile.id;

  const supabase = getSupabaseAdmin();
  const access = await getBookAccess(supabase, profile.id, bookOwnerId);
  if (!access || !hasPermission(access, "add_expense")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: invoices }, { data: imported }] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, total, subtotal, tax_amount, paid_at, organization_id, organizations(name)")
      .eq("customer_id", bookOwnerId)
      .eq("status", "paid")
      .order("paid_at", { ascending: false }),
    supabase.from("expense_transactions").select("linked_invoice_id").eq("customer_id", bookOwnerId).not("linked_invoice_id", "is", null),
  ]);

  const importedIds = new Set((imported ?? []).map((r) => r.linked_invoice_id));
  const available = (invoices ?? [])
    .filter((inv) => !importedIds.has(inv.id))
    .map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      total: Number(inv.total),
      subtotal: Number(inv.subtotal),
      taxAmount: Number(inv.tax_amount),
      paidAt: inv.paid_at,
      issuerName: (inv.organizations as unknown as { name: string } | null)?.name ?? "Legal Efilings",
    }));

  return NextResponse.json({ invoices: available });
}
