import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { Document, Page, Text, StyleSheet } from "@react-pdf/renderer";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentProfile } from "@/lib/current-profile";
import { isStaffOrAdmin } from "@/lib/roles";
import { getLetterTemplate } from "@/content/hr-letter-templates";
import { SITE_NAME } from "@/config/site";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, color: "#0f172a", lineHeight: 1.5 },
  brand: { fontSize: 16, fontWeight: 700, marginBottom: 30 },
  subject: { fontSize: 12, fontWeight: 700, marginBottom: 16, textDecoration: "underline" },
  paragraph: { marginBottom: 12 },
});

function LetterPdf({ subject, paragraphs }: { subject: string; paragraphs: string[] }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>{SITE_NAME}</Text>
        <Text style={styles.subject}>Subject: {subject}</Text>
        {paragraphs.map((p, i) => (
          <Text key={i} style={styles.paragraph}>{p}</Text>
        ))}
      </Page>
    </Document>
  );
}

// POST /api/hr-letters/generate — staff/admin only. Fills the chosen
// template with the submitted fields and returns a PDF. Logs a row to
// generated_letters for audit (who generated what, for whom, when) —
// the letter content itself isn't stored, only the fact it was generated.
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!isStaffOrAdmin(profile) || !profile) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const templateSlug = body?.templateSlug;
  const fields = body?.fields as Record<string, string> | undefined;
  const staffId = body?.staffId as string | undefined;

  const template = templateSlug ? getLetterTemplate(templateSlug) : undefined;
  if (!template || !fields) return NextResponse.json({ error: "Invalid template or fields" }, { status: 400 });

  const missing = template.fields.filter((f) => !fields[f.key]?.trim());
  if (missing.length > 0) {
    return NextResponse.json({ error: `Missing required field(s): ${missing.map((f) => f.label).join(", ")}` }, { status: 400 });
  }

  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const paragraphs = template.body(fields, SITE_NAME, today).filter(Boolean);
  const subject = template.subject(fields);

  const buffer = await renderToBuffer(<LetterPdf subject={subject} paragraphs={paragraphs} />);

  const supabase = getSupabaseAdmin();
  await supabase.from("generated_letters").insert({
    template_slug: template.slug,
    staff_id: staffId ?? null,
    employee_name: fields.employeeName,
    generated_by: profile.id,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${template.name.replace(/\s+/g, "-")}-${fields.employeeName.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
