import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { getReportingChainIds } from "@/lib/reporting-chain";
import { isStaffOrAdmin } from "@/lib/roles";
import { SITE_NAME, BUSINESS_PHONE } from "@/config/site";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { fontSize: 18, fontWeight: 700, color: "#0f172a" },
  muted: { color: "#5b6b81" },
  section: { marginBottom: 16 },
  label: { fontSize: 8, textTransform: "uppercase", color: "#5b6b81", marginBottom: 2 },
  table: { marginTop: 12 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e8ecf2", paddingVertical: 6 },
  thText: { fontSize: 9, fontWeight: 700, color: "#0f172a" },
  tdText: { fontSize: 9, color: "#334155" },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1, textAlign: "right" },
  colAmount: { flex: 1, textAlign: "right" },
  totals: { marginTop: 16, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", width: 200, marginBottom: 4 },
  grandTotal: { fontSize: 12, fontWeight: 700 },
});

function InvoicePdf({
  invoiceNumber,
  issuedAt,
  customerName,
  customerCompany,
  items,
  subtotal,
  taxAmount,
  total,
}: {
  invoiceNumber: string;
  issuedAt: string;
  customerName: string;
  customerCompany: string | null;
  items: { description: string; quantity: number; unit_price: number; amount: number }[];
  subtotal: number;
  taxAmount: number;
  total: number;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{SITE_NAME}</Text>
            <Text style={styles.muted}>Real experts. Real filings.</Text>
            <Text style={styles.muted}>{BUSINESS_PHONE.display}</Text>
          </View>
          <View>
            <Text style={styles.label}>Invoice</Text>
            <Text style={{ fontSize: 14, fontWeight: 700 }}>{invoiceNumber}</Text>
            <Text style={styles.muted}>{new Date(issuedAt).toLocaleDateString("en-IN")}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Billed To</Text>
          <Text>{customerName}</Text>
          {customerCompany && <Text style={styles.muted}>{customerCompany}</Text>}
        </View>

        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={[styles.thText, styles.colDesc]}>Description</Text>
            <Text style={[styles.thText, styles.colQty]}>Qty</Text>
            <Text style={[styles.thText, styles.colPrice]}>Unit Price</Text>
            <Text style={[styles.thText, styles.colAmount]}>Amount</Text>
          </View>
          {items.map((item, i) => (
            <View style={styles.tr} key={i}>
              <Text style={[styles.tdText, styles.colDesc]}>{item.description}</Text>
              <Text style={[styles.tdText, styles.colQty]}>{item.quantity}</Text>
              <Text style={[styles.tdText, styles.colPrice]}>₹{Number(item.unit_price).toLocaleString("en-IN")}</Text>
              <Text style={[styles.tdText, styles.colAmount]}>₹{Number(item.amount).toLocaleString("en-IN")}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>₹{Number(subtotal).toLocaleString("en-IN")}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Tax</Text>
            <Text>₹{Number(taxAmount).toLocaleString("en-IN")}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.grandTotal}>Total</Text>
            <Text style={styles.grandTotal}>₹{Number(total).toLocaleString("en-IN")}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, profiles!invoices_customer_id_fkey(full_name, company), invoice_line_items(*)")
    .eq("id", id)
    .single();

  if (error || !invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  const isOwnCustomerInvoice = invoice.customer_id === profile.id;
  if (!isOwnCustomerInvoice) {
    if (!isStaffOrAdmin(profile)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Same scoping as the invoices list: a non-admin can only download an
    // invoice they created or one their reporting chain created, not any
    // invoice in the system by guessing/being handed its id.
    if (profile.account_type !== "admin") {
      const chain = await getReportingChainIds(profile.id);
      if (!invoice.created_by || ![profile.id, ...chain].includes(invoice.created_by)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  const buffer = await renderToBuffer(
    <InvoicePdf
      invoiceNumber={invoice.invoice_number}
      issuedAt={invoice.issued_at ?? invoice.created_at}
      customerName={invoice.profiles?.full_name ?? "Customer"}
      customerCompany={invoice.profiles?.company ?? null}
      items={invoice.invoice_line_items ?? []}
      subtotal={invoice.subtotal}
      taxAmount={invoice.tax_amount}
      total={invoice.total}
    />
  );

  await supabase.from("invoice_events").insert({ invoice_id: id, event_type: "downloaded", actor_id: profile.id });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
