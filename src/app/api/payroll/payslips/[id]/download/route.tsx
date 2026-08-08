import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { SITE_NAME } from "@/config/site";
import { canSeeAllOrgs } from "@/lib/organization";
import { hasToolAccess } from "@/lib/tool-grants";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  brand: { fontSize: 18, fontWeight: 700, color: "#0f172a" },
  muted: { color: "#5b6b81" },
  summaryRow: { flexDirection: "row", gap: 24, marginBottom: 20 },
  summaryBox: { flex: 1, padding: 10, backgroundColor: "#f6f8fb", borderRadius: 8 },
  summaryLabel: { fontSize: 8, textTransform: "uppercase", color: "#5b6b81", marginBottom: 2 },
  summaryValue: { fontSize: 14, fontWeight: 700, color: "#0f172a" },
  table: { marginTop: 8 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e8ecf2", paddingVertical: 6 },
  thText: { fontSize: 9, fontWeight: 700, color: "#0f172a" },
  tdText: { fontSize: 9, color: "#334155" },
  col: { flex: 1 },
  netBox: { marginTop: 16, padding: 12, backgroundColor: "#fff6d9", borderRadius: 8, flexDirection: "row", justifyContent: "space-between" },
  netLabel: { fontSize: 11, fontWeight: 700, color: "#0f172a" },
  netValue: { fontSize: 14, fontWeight: 700, color: "#0f172a" },
});

// "Rs. " rather than "₹" — @react-pdf/renderer's default font (Helvetica,
// one of the fixed PDF Standard 14 fonts from the 1980s) has no glyph for
// ₹ (Unicode U+20B9, only added in 2010) since no custom font is
// registered here. Without this, every amount on the PDF would render
// with a missing-glyph box instead of a currency symbol — the on-screen
// app is unaffected, since browsers/Inter render ₹ correctly.
function money(n: number) {
  return `Rs. ${Number(n).toLocaleString("en-IN")}`;
}

function PayslipPdf({
  employeeName,
  designation,
  department,
  monthLabel,
  earnings,
  deductions,
  grossSalary,
  netSalary,
}: {
  employeeName: string;
  designation: string;
  department: string;
  monthLabel: string;
  earnings: { label: string; amount: number }[];
  deductions: { label: string; amount: number }[];
  grossSalary: number;
  netSalary: number;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{SITE_NAME}</Text>
            <Text style={styles.muted}>Payslip — {monthLabel}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 13, fontWeight: 700 }}>{employeeName}</Text>
            <Text style={styles.muted}>{designation}{department ? ` · ${department}` : ""}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Gross Salary</Text>
            <Text style={styles.summaryValue}>{money(grossSalary)}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Net Salary</Text>
            <Text style={styles.summaryValue}>{money(netSalary)}</Text>
          </View>
        </View>

        <Text style={{ fontSize: 10, fontWeight: 700, marginBottom: 4 }}>Earnings</Text>
        <View style={styles.table}>
          {earnings.map((row, i) => (
            <View style={styles.tr} key={i}>
              <Text style={[styles.tdText, styles.col]}>{row.label}</Text>
              <Text style={[styles.tdText, styles.col, { textAlign: "right" }]}>{money(row.amount)}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 10, fontWeight: 700, marginTop: 16, marginBottom: 4 }}>Deductions</Text>
        <View style={styles.table}>
          {deductions.map((row, i) => (
            <View style={styles.tr} key={i}>
              <Text style={[styles.tdText, styles.col]}>{row.label}</Text>
              <Text style={[styles.tdText, styles.col, { textAlign: "right" }]}>{money(row.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.netBox}>
          <Text style={styles.netLabel}>Net Salary Payable</Text>
          <Text style={styles.netValue}>{money(netSalary)}</Text>
        </View>

        <Text style={{ marginTop: 30, fontSize: 8, color: "#5b6b81" }}>
          This is a system-generated payslip and does not require a physical signature.
        </Text>
      </Page>
    </Document>
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data: payslip, error } = await supabase
    .from("payslips")
    .select("*, profiles!payslips_staff_id_fkey(full_name, designation, department)")
    .eq("id", id)
    .single();

  if (error || !payslip) return NextResponse.json({ error: "Payslip not found" }, { status: 404 });
  if (payslip.staff_id !== profile.id && !(await hasToolAccess(profile, "payslips"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!canSeeAllOrgs(profile) && payslip.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const monthLabel = new Date(`${payslip.year}-${String(payslip.month).padStart(2, "0")}-01`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  const buffer = await renderToBuffer(
    <PayslipPdf
      employeeName={payslip.profiles?.full_name ?? "Employee"}
      designation={payslip.profiles?.designation ?? ""}
      department={payslip.profiles?.department ?? ""}
      monthLabel={monthLabel}
      earnings={[
        { label: "Basic Salary", amount: payslip.basic },
        { label: "HRA", amount: payslip.hra },
        { label: "Special Allowance", amount: payslip.special_allowance },
        { label: "Bonus", amount: payslip.bonus },
        { label: "Incentives", amount: payslip.incentives },
        { label: "Overtime", amount: payslip.overtime },
      ]}
      deductions={[
        { label: "Provident Fund (PF)", amount: payslip.pf_deduction },
        { label: "ESI", amount: payslip.esi_deduction },
        { label: "Professional Tax", amount: payslip.professional_tax },
        { label: "TDS", amount: payslip.tds },
        ...(Number(payslip.lop_days) > 0
          ? [{ label: `Loss of Pay (${Number(payslip.lop_days)} day${Number(payslip.lop_days) === 1 ? "" : "s"})`, amount: payslip.lop_deduction }]
          : []),
      ]}
      grossSalary={payslip.gross_salary}
      netSalary={payslip.net_salary}
    />
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Payslip-${monthLabel.replace(" ", "-")}.pdf"`,
    },
  });
}
