import type { getSupabaseAdmin } from "@/lib/supabase-admin";

type Supabase = ReturnType<typeof getSupabaseAdmin>;

// Indian financial year label for a date, e.g. 2026-08-09 with an April
// start becomes "2026-27". The start month is per-organization
// (company_settings.financial_year_start_month, April by default) —
// invoice series restart each financial year, which is the convention
// GST filings are organised around.
export function financialYearLabel(date: Date, startMonth: number): string {
  const month = date.getMonth() + 1;
  const startYear = month >= startMonth ? date.getFullYear() : date.getFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

// Allocates the next consecutive invoice number for an organization's
// current financial-year series, as required by CGST Rule 46(b).
//
// The counter lives in the database and is incremented by
// next_invoice_number() (see 20260830000000) rather than derived from
// existing rows: a "read the highest number then add one" in application
// code would hand the same number to two invoices created concurrently,
// and the whole point of a serial series is that it has no gaps and no
// duplicates.
export async function allocateInvoiceNumber(
  supabase: Supabase,
  organizationId: string,
  opts?: { prefix?: string | null; financialYearStartMonth?: number | null; now?: Date }
): Promise<string> {
  const prefix = (opts?.prefix || "INV").trim();
  const startMonth = opts?.financialYearStartMonth ?? 4;
  const fy = financialYearLabel(opts?.now ?? new Date(), startMonth);
  const series = `${prefix}/${fy}`;

  const { data, error } = await supabase.rpc("next_invoice_number", {
    p_org: organizationId,
    p_series: series,
  });
  if (error) throw new Error(`Could not allocate an invoice number: ${error.message}`);

  return `${series}/${String(data).padStart(4, "0")}`;
}
