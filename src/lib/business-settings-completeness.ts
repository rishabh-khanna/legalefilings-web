// What "complete" means for an org's Business Settings (the
// company_settings table — table name kept as-is; only the user-facing
// label/route were renamed from "Company Settings"). Kept intentionally
// small and specific to what invoice generation actually needs: a real
// business identity (address/GSTIN/PAN/state, the same fields that print
// on every invoice PDF and drive the CGST+SGST vs IGST split) plus at
// least one way to actually get paid (full bank details, or a UPI ID).
// PF/ESIC numbers, logo, signature, and invoice notes stay optional —
// real, but not blocking.
export type BusinessSettingsRow = {
  address: string | null;
  gst_number: string | null;
  pan_number: string | null;
  state: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  upi_id: string | null;
};

function filled(value: string | null | undefined): boolean {
  return !!value && value.trim() !== "";
}

export function getMissingBusinessSettingsFields(settings: BusinessSettingsRow | null): string[] {
  if (!settings) {
    return ["Address", "GST Number", "PAN Number", "State", "a payment method (bank details or UPI)"];
  }
  const missing: string[] = [];
  if (!filled(settings.address)) missing.push("Address");
  if (!filled(settings.gst_number)) missing.push("GST Number");
  if (!filled(settings.pan_number)) missing.push("PAN Number");
  if (!filled(settings.state)) missing.push("State");
  const hasBankDetails = filled(settings.bank_name) && filled(settings.bank_account_number) && filled(settings.bank_ifsc);
  const hasUpi = filled(settings.upi_id);
  if (!hasBankDetails && !hasUpi) missing.push("a payment method (bank details or UPI)");
  return missing;
}
