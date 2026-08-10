import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { SITE_NAME, BUSINESS_PHONE } from "@/config/site";

const classicStyles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  logo: { height: 32, marginBottom: 6 },
  brand: { fontSize: 16, fontWeight: 700, color: "#0f172a" },
  muted: { color: "#5b6b81" },
  small: { fontSize: 8, color: "#5b6b81" },
  typeBadge: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#8a6700" },
  twoCol: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  col: { width: "48%" },
  label: { fontSize: 7, textTransform: "uppercase", color: "#5b6b81", marginBottom: 2, marginTop: 4 },
  table: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#e8ecf2" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e8ecf2", paddingVertical: 5 },
  thText: { fontSize: 7.5, fontWeight: 700, color: "#0f172a" },
  tdText: { fontSize: 7.5, color: "#334155" },
  colDesc: { flex: 3 },
  colHsn: { flex: 1.2 },
  colQty: { flex: 0.8, textAlign: "right" },
  colRate: { flex: 1, textAlign: "right" },
  colDisc: { flex: 1, textAlign: "right" },
  colGst: { flex: 1, textAlign: "right" },
  colAmount: { flex: 1.2, textAlign: "right" },
  totals: { marginTop: 12, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", width: 220, marginBottom: 3 },
  grandTotal: { fontSize: 11, fontWeight: 700 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18 },
  bankBox: { width: "48%" },
  qr: { height: 70, width: 70, marginTop: 4 },
  signature: { height: 36, marginTop: 4 },
  notes: { marginTop: 12, fontSize: 7.5, color: "#5b6b81" },
});

// "Modern" template — same data, a colored header band and accent rules
// instead of the classic plain-white layout. Genuinely different output,
// not a re-skin via a single color variable, so picking it actually
// changes what a customer receives.
const modernStyles = StyleSheet.create({
  ...classicStyles,
  page: { padding: 0, fontSize: 9, color: "#0f172a" },
  headerBand: { backgroundColor: "#1b4ba4", padding: 28, flexDirection: "row", justifyContent: "space-between" },
  bodyPad: { padding: 28 },
  brandWhite: { fontSize: 16, fontWeight: 700, color: "#ffffff" },
  mutedWhite: { color: "#dbe5fb" },
  typeBadgeModern: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "#fdc500" },
});

// "Rs. " rather than "₹" — @react-pdf/renderer's default font (Helvetica,
// one of the fixed PDF Standard 14 fonts from the 1980s) has no glyph for
// ₹ (Unicode U+20B9, only added in 2010) since no custom font is
// registered anywhere in this app. Without this, every amount on every
// generated invoice would render with a missing-glyph box instead of a
// currency symbol — the on-screen app is unaffected, since browsers/
// Inter render ₹ correctly there.
function money(n: number) {
  return `Rs. ${Number(n).toLocaleString("en-IN")}`;
}

const TYPE_LABELS: Record<string, string> = {
  gst: "Tax Invoice",
  non_gst: "Invoice",
  export: "Export Invoice",
  proforma: "Proforma Invoice",
  credit_note: "Credit Note",
  debit_note: "Debit Note",
};

export type PdfLineItem = {
  description: string;
  hsn_sac_code: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  discount: number;
  gst_rate: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  amount: number;
};

function Totals({ invoice, styles }: { invoice: Record<string, unknown>; styles: typeof classicStyles }) {
  return (
    <View style={styles.totals}>
      <View style={styles.totalRow}>
        <Text style={styles.muted}>Taxable Value</Text>
        <Text>{money(Number(invoice.subtotal))}</Text>
      </View>
      {Number(invoice.discount_amount) > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.muted}>Discount</Text>
          <Text>- {money(Number(invoice.discount_amount))}</Text>
        </View>
      )}
      {Number(invoice.cgst_total) > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.muted}>CGST</Text>
          <Text>{money(Number(invoice.cgst_total))}</Text>
        </View>
      )}
      {Number(invoice.sgst_total) > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.muted}>SGST</Text>
          <Text>{money(Number(invoice.sgst_total))}</Text>
        </View>
      )}
      {Number(invoice.igst_total) > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.muted}>IGST</Text>
          <Text>{money(Number(invoice.igst_total))}</Text>
        </View>
      )}
      {(Number(invoice.freight) > 0 || Number(invoice.packing) > 0 || Number(invoice.courier) > 0 || Number(invoice.other_charges) > 0) && (
        <View style={styles.totalRow}>
          <Text style={styles.muted}>Other Charges</Text>
          <Text>{money(Number(invoice.freight) + Number(invoice.packing) + Number(invoice.courier) + Number(invoice.other_charges))}</Text>
        </View>
      )}
      <View style={styles.totalRow}>
        <Text style={styles.grandTotal}>Invoice Value</Text>
        <Text style={styles.grandTotal}>{money(Number(invoice.total))}</Text>
      </View>
      {Number(invoice.tds_amount) > 0 && (
        <>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Less TDS ({invoice.tds_rate as number}%)</Text>
            <Text>- {money(Number(invoice.tds_amount))}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={{ fontWeight: 700 }}>Net Receivable</Text>
            <Text style={{ fontWeight: 700 }}>{money(Number(invoice.total) - Number(invoice.tds_amount))}</Text>
          </View>
        </>
      )}
    </View>
  );
}

function ItemsTable({ items, isTaxable, styles }: { items: PdfLineItem[]; isTaxable: boolean; styles: typeof classicStyles }) {
  return (
    <View style={styles.table}>
      <View style={styles.tr} fixed>
        <Text style={[styles.thText, styles.colDesc]}>Item</Text>
        <Text style={[styles.thText, styles.colHsn]}>HSN/SAC</Text>
        <Text style={[styles.thText, styles.colQty]}>Qty</Text>
        <Text style={[styles.thText, styles.colRate]}>Rate</Text>
        <Text style={[styles.thText, styles.colDisc]}>Discount</Text>
        {isTaxable && <Text style={[styles.thText, styles.colGst]}>GST</Text>}
        <Text style={[styles.thText, styles.colAmount]}>Amount</Text>
      </View>
      {items.map((item, i) => (
        <View style={styles.tr} key={i} wrap={false}>
          <Text style={[styles.tdText, styles.colDesc]}>{item.description}</Text>
          <Text style={[styles.tdText, styles.colHsn]}>{item.hsn_sac_code ?? "—"}</Text>
          <Text style={[styles.tdText, styles.colQty]}>{item.quantity} {item.unit}</Text>
          <Text style={[styles.tdText, styles.colRate]}>{money(Number(item.unit_price))}</Text>
          <Text style={[styles.tdText, styles.colDisc]}>{item.discount ? money(Number(item.discount)) : "—"}</Text>
          {isTaxable && <Text style={[styles.tdText, styles.colGst]}>{item.gst_rate}%</Text>}
          <Text style={[styles.tdText, styles.colAmount]}>{money(Number(item.amount))}</Text>
        </View>
      ))}
    </View>
  );
}

function Footer({ invoice, company, qrDataUrl, styles }: { invoice: Record<string, unknown>; company: Record<string, unknown> | null; qrDataUrl: string | null; styles: typeof classicStyles }) {
  return (
    <>
      <View style={styles.footerRow}>
        <View style={styles.bankBox}>
          {company?.bank_name ? (
            <>
              <Text style={styles.label}>Bank Details</Text>
              <Text style={styles.small}>{company.bank_name as string}</Text>
              {company.bank_account_number ? <Text style={styles.small}>A/C: {company.bank_account_number as string}</Text> : null}
              {company.bank_ifsc ? <Text style={styles.small}>IFSC: {company.bank_ifsc as string}</Text> : null}
              {company.bank_branch ? <Text style={styles.small}>Branch: {company.bank_branch as string}</Text> : null}
              {company.upi_id ? <Text style={styles.small}>UPI: {company.upi_id as string}</Text> : null}
            </>
          ) : null}
          {qrDataUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={qrDataUrl} style={styles.qr} />
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {typeof company?.signature_url === "string" && company.signature_url ? (
            <>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={company.signature_url as string} style={styles.signature} />
              <Text style={styles.small}>Authorized Signatory</Text>
            </>
          ) : null}
        </View>
      </View>
      {invoice.notes ? <Text style={styles.notes}>{invoice.notes as string}</Text> : null}
    </>
  );
}

export function InvoicePdf({ invoice, company, items, qrDataUrl, template }: { invoice: Record<string, unknown>; company: Record<string, unknown> | null; items: PdfLineItem[]; qrDataUrl: string | null; template?: string }) {
  const profiles = invoice.profiles as { full_name: string | null; company: string | null } | null;
  const hasCgstSgst = items.some((i) => i.cgst_amount > 0 || i.sgst_amount > 0);
  const hasIgst = items.some((i) => i.igst_amount > 0);
  const isTaxable = hasCgstSgst || hasIgst;

  if (template === "modern") {
    const styles = modernStyles;
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.headerBand}>
            <View>
              {typeof company?.logo_url === "string" && company.logo_url ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={company.logo_url as string} style={styles.logo} />
              ) : (
                <Text style={styles.brandWhite}>{SITE_NAME}</Text>
              )}
              <Text style={styles.mutedWhite}>{(company?.address as string) ?? ""}</Text>
              <Text style={styles.mutedWhite}>{BUSINESS_PHONE.display}</Text>
              {company?.gst_number ? <Text style={[styles.small, { color: "#dbe5fb" }]}>GSTIN: {company.gst_number as string}</Text> : null}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.typeBadgeModern}>{TYPE_LABELS[invoice.invoice_type as string] ?? "Invoice"}</Text>
              <Text style={{ fontSize: 13, fontWeight: 700, marginTop: 4, color: "#ffffff" }}>{invoice.invoice_number as string}</Text>
              <Text style={styles.mutedWhite}>Date: {new Date((invoice.issued_at as string) ?? (invoice.created_at as string)).toLocaleDateString("en-IN")}</Text>
              {invoice.due_at ? <Text style={styles.mutedWhite}>Due: {new Date(invoice.due_at as string).toLocaleDateString("en-IN")}</Text> : null}
            </View>
          </View>

          <View style={styles.bodyPad}>
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={styles.label}>Bill To</Text>
                <Text style={{ fontWeight: 700 }}>{profiles?.full_name ?? "Customer"}</Text>
                {profiles?.company ? <Text style={styles.muted}>{profiles.company}</Text> : null}
                {invoice.customer_billing_address ? <Text style={styles.muted}>{invoice.customer_billing_address as string}</Text> : null}
                {invoice.customer_gstin ? <Text style={styles.small}>GSTIN: {invoice.customer_gstin as string}</Text> : null}
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Details</Text>
                {invoice.place_of_supply ? <Text style={styles.muted}>Place of Supply: {invoice.place_of_supply as string}</Text> : null}
                <Text style={styles.muted}>Payment Terms: {invoice.payment_terms as string}</Text>
                <Text style={styles.muted}>Reverse Charge: {invoice.reverse_charge ? "Yes" : "No"}</Text>
              </View>
            </View>

            <ItemsTable items={items} isTaxable={isTaxable} styles={styles} />
            <Totals invoice={invoice} styles={styles} />
            <Footer invoice={invoice} company={company} qrDataUrl={qrDataUrl} styles={styles} />
          </View>
        </Page>
      </Document>
    );
  }

  const styles = classicStyles;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            {typeof company?.logo_url === "string" && company.logo_url ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={company.logo_url as string} style={styles.logo} />
            ) : (
              <Text style={styles.brand}>{SITE_NAME}</Text>
            )}
            <Text style={styles.muted}>{(company?.address as string) ?? ""}</Text>
            <Text style={styles.muted}>{BUSINESS_PHONE.display}</Text>
            {company?.gst_number ? <Text style={styles.small}>GSTIN: {company.gst_number as string}</Text> : null}
            {company?.pan_number ? <Text style={styles.small}>PAN: {company.pan_number as string}</Text> : null}
            {company?.state ? <Text style={styles.small}>State: {company.state as string}{company.state_code ? ` (${company.state_code as string})` : ""}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.typeBadge}>{TYPE_LABELS[invoice.invoice_type as string] ?? "Invoice"}</Text>
            <Text style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>{invoice.invoice_number as string}</Text>
            <Text style={styles.muted}>Date: {new Date((invoice.issued_at as string) ?? (invoice.created_at as string)).toLocaleDateString("en-IN")}</Text>
            {invoice.due_at ? <Text style={styles.muted}>Due: {new Date(invoice.due_at as string).toLocaleDateString("en-IN")}</Text> : null}
            {invoice.related_invoice_id ? <Text style={styles.small}>Against Invoice: {(invoice.related_invoice_number as string) ?? "—"}</Text> : null}
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.label}>Bill To</Text>
            <Text style={{ fontWeight: 700 }}>{profiles?.full_name ?? "Customer"}</Text>
            {profiles?.company ? <Text style={styles.muted}>{profiles.company}</Text> : null}
            {invoice.customer_billing_address ? <Text style={styles.muted}>{invoice.customer_billing_address as string}</Text> : null}
            {invoice.customer_gstin ? <Text style={styles.small}>GSTIN: {invoice.customer_gstin as string}</Text> : null}
            {invoice.customer_pan ? <Text style={styles.small}>PAN: {invoice.customer_pan as string}</Text> : null}
            {invoice.customer_state ? <Text style={styles.small}>State: {invoice.customer_state as string}{invoice.customer_state_code ? ` (${invoice.customer_state_code as string})` : ""}</Text> : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Details</Text>
            {invoice.place_of_supply ? <Text style={styles.muted}>Place of Supply: {invoice.place_of_supply as string}</Text> : null}
            <Text style={styles.muted}>Payment Terms: {invoice.payment_terms as string}</Text>
            <Text style={styles.muted}>Reverse Charge: {invoice.reverse_charge ? "Yes" : "No"}</Text>
            {invoice.customer_shipping_address ? (
              <>
                <Text style={styles.label}>Ship To</Text>
                <Text style={styles.muted}>{invoice.customer_shipping_address as string}</Text>
              </>
            ) : null}
          </View>
        </View>

        <ItemsTable items={items} isTaxable={isTaxable} styles={styles} />
        <Totals invoice={invoice} styles={styles} />
        <Footer invoice={invoice} company={company} qrDataUrl={qrDataUrl} styles={styles} />
      </Page>
    </Document>
  );
}

export async function buildInvoicePdfBuffer(opts: {
  invoice: Record<string, unknown>;
  company: Record<string, unknown> | null;
  items: PdfLineItem[];
  /** Issuing organization's name — the QR's payee label. */
  orgName?: string | null;
}) {
  let qrDataUrl: string | null = null;
  if (opts.company?.upi_id) {
    // Amount is the balance still owed, not the invoice face value. The
    // QR used to always request the full total, so a customer who had
    // already part-paid and then scanned the code on their copy would be
    // asked for the whole amount again — overcharging them by whatever
    // they'd already sent.
    const payments = (opts.invoice.invoice_payments as { amount: number }[] | null) ?? [];
    const paid = payments.reduce((s, p) => s + Number(p.amount), 0);
    const balanceDue = Math.max(0, Number(opts.invoice.total ?? 0) - paid);

    // Nothing owed means no QR at all. Rendering a scannable pay code on
    // a settled invoice invites a duplicate payment.
    if (balanceDue > 0.5) {
      // Payee name is the org that actually issued this invoice, not the
      // platform. It was hardcoded to Legal Efilings while the payee UPI
      // ID came from the tenant's own settings — so a tenant's customer
      // scanned a code that paid the tenant but displayed "Legal
      // Efilings" in their UPI app, which reads like a mis-issued or
      // fraudulent request.
      const payeeName = opts.orgName || (opts.company.business_name as string) || SITE_NAME;
      const upiUri = `upi://pay?pa=${encodeURIComponent(opts.company.upi_id as string)}&pn=${encodeURIComponent(payeeName)}&am=${balanceDue.toFixed(2)}&tn=${encodeURIComponent((opts.invoice.invoice_number as string) ?? "")}`;
      qrDataUrl = await QRCode.toDataURL(upiUri, { margin: 1, width: 200 }).catch(() => null);
    }
  }
  return renderToBuffer(
    <InvoicePdf invoice={opts.invoice} company={opts.company} items={opts.items} qrDataUrl={qrDataUrl} template={(opts.invoice.pdf_template as string) ?? "classic"} />
  );
}
