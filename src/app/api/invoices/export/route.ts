import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { isStaffOrAdmin } from "@/lib/roles";
import { canSeeAllOrgs } from "@/lib/organization";

function toCsvCell(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
function toCsv(rows: string[][]) {
  return rows.map((row) => row.map(toCsvCell).join(",")).join("\n");
}

// GET /api/invoices/export?origin=order|billed — CSV of exactly what the
// caller can already see in the list (same reporting-chain scoping as
// GET /api/invoices), split the same way the UI is: order-linked vs.
// ad-hoc CRM invoices.
export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const origin = searchParams.get("origin");

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("invoices")
    .select("invoice_number, invoice_type, total, status, created_at, due_at, order_id, profiles!invoices_customer_id_fkey(full_name), invoice_payments(amount)")
    .order("created_at", { ascending: false });

  if (!canSeeAllOrgs(profile)) query = query.eq("organization_id", profile.organization_id);
  // canSeeAllOrgs (is_platform_admin) must also skip the reporting-chain
  // narrowing below — independent axis from account_type.
  if (profile.account_type !== "admin" && !canSeeAllOrgs(profile)) {
    const chain = await getReportingChainIds(profile.id);
    query = query.in("created_by", [profile.id, ...chain]);
  }
  if (origin === "order") query = query.not("order_id", "is", null);
  if (origin === "billed") query = query.is("order_id", null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = [["Invoice", "Type", "Customer", "Date", "Due Date", "Total", "Paid", "Balance", "Status"]];
  for (const inv of (data ?? []) as unknown as {
    invoice_number: string; invoice_type: string; total: number; status: string; created_at: string; due_at: string | null;
    profiles: { full_name: string | null } | null; invoice_payments: { amount: number }[];
  }[]) {
    const paid = (inv.invoice_payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    rows.push([
      inv.invoice_number,
      inv.invoice_type,
      inv.profiles?.full_name ?? "",
      new Date(inv.created_at).toLocaleDateString("en-IN"),
      inv.due_at ? new Date(inv.due_at).toLocaleDateString("en-IN") : "",
      String(inv.total),
      String(paid),
      String(Math.max(0, Number(inv.total) - paid)),
      inv.status,
    ]);
  }

  return new NextResponse(toCsv(rows), {
    headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${origin ?? "all"}-invoices.csv"` },
  });
}
