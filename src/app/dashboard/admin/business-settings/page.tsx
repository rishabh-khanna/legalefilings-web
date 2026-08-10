"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";
import { RequiredMark } from "@/components/RequiredMark";
import { StateSelect } from "@/components/StateSelect";
import { gstStateCode } from "@/lib/gst-state-codes";
import { getMissingBusinessSettingsFields } from "@/lib/business-settings-completeness";

type GstRegistration = { id: string; label: string; gst_number: string; state: string | null; state_code: string | null; is_default: boolean; organization_id: string; organizations?: { name: string | null } | null; creator?: { full_name: string | null } | null };

type Settings = {
  logo_url: string | null;
  signature_url: string | null;
  address: string | null;
  gst_number: string | null;
  pan_number: string | null;
  pf_number: string | null;
  esic_number: string | null;
  financial_year_start_month: number;
  state: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_branch: string | null;
  upi_id: string | null;
  default_invoice_notes: string | null;
  invoice_number_prefix: string;
  updated_at?: string;
  updater?: { full_name: string | null } | null;
};

export default function BusinessSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [address, setAddress] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [pfNumber, setPfNumber] = useState("");
  const [esicNumber, setEsicNumber] = useState("");
  const [fyMonth, setFyMonth] = useState(4);
  const [state, setState] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [upiId, setUpiId] = useState("");
  const [defaultInvoiceNotes, setDefaultInvoiceNotes] = useState("");
  const [invoiceNumberPrefix, setInvoiceNumberPrefix] = useState("INV");
  const [saving, setSaving] = useState(false);
  const [savingInvoicing, setSavingInvoicing] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const { message, showSuccess, showError } = useActionMessage();

  const [registrations, setRegistrations] = useState<GstRegistration[]>([]);
  const [regLabel, setRegLabel] = useState("");
  const [regGstNumber, setRegGstNumber] = useState("");
  const [regState, setRegState] = useState("");
  const [savingRegistration, setSavingRegistration] = useState(false);

  async function loadRegistrations() {
    const res = await fetch("/api/company-gst-registrations");
    if (res.ok) setRegistrations((await res.json()).registrations ?? []);
  }

  async function handleAddRegistration(e: React.FormEvent) {
    e.preventDefault();
    if (!regLabel || !regGstNumber) return;
    setSavingRegistration(true);
    const res = await fetch("/api/company-gst-registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: regLabel, gstNumber: regGstNumber, state: regState, stateCode: gstStateCode(regState) }),
    });
    setSavingRegistration(false);
    if (res.ok) {
      setRegLabel("");
      setRegGstNumber("");
      setRegState("");
      await loadRegistrations();
      showSuccess("GST registration added.");
    } else {
      showError("Failed to add registration.");
    }
  }

  async function handleRemoveRegistration(id: string, label: string) {
    if (!window.confirm(`Remove the GST registration "${label}"? This can't be undone.`)) return;
    const res = await fetch(`/api/company-gst-registrations/${id}`, { method: "DELETE" });
    if (res.ok) {
      await loadRegistrations();
      showSuccess("Registration removed.");
    } else {
      showError("Failed to remove registration.");
    }
  }

  async function load() {
    const res = await fetch("/api/business-settings");
    const data = await res.json();
    if (res.ok && data.settings) {
      setSettings(data.settings);
      setAddress(data.settings.address ?? "");
      setGstNumber(data.settings.gst_number ?? "");
      setPanNumber(data.settings.pan_number ?? "");
      setPfNumber(data.settings.pf_number ?? "");
      setEsicNumber(data.settings.esic_number ?? "");
      setFyMonth(data.settings.financial_year_start_month ?? 4);
      setState(data.settings.state ?? "");
      setBankName(data.settings.bank_name ?? "");
      setBankAccountNumber(data.settings.bank_account_number ?? "");
      setBankIfsc(data.settings.bank_ifsc ?? "");
      setBankBranch(data.settings.bank_branch ?? "");
      setUpiId(data.settings.upi_id ?? "");
      setDefaultInvoiceNotes(data.settings.default_invoice_notes ?? "");
      setInvoiceNumberPrefix(data.settings.invoice_number_prefix ?? "INV");
    }
  }

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      await load();
      await loadRegistrations();
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/business-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      // state/stateCode included here too, not just in Save Invoicing
      // Settings below — the State field visually lives in this
      // "Company Details" form (right next to this button), so clicking
      // Save Settings without also filling and saving the separate
      // Invoicing form used to silently NOT persist it at all.
      body: JSON.stringify({ address, gstNumber, panNumber, pfNumber, esicNumber, financialYearStartMonth: fyMonth, state, stateCode: gstStateCode(state) }),
    });
    setSaving(false);
    if (res.ok) {
      showSuccess("Settings saved.");
      await load();
    } else {
      showError("Failed to save settings.");
    }
  }

  async function handleSaveInvoicing(e: React.FormEvent) {
    e.preventDefault();
    const hasBankDetails = bankName.trim() && bankAccountNumber.trim() && bankIfsc.trim();
    if (!hasBankDetails && !upiId.trim()) {
      showError("At least one of Bank Details (Bank Name, Account Number, and IFSC) or UPI ID is required.");
      return;
    }
    setSavingInvoicing(true);
    const res = await fetch("/api/business-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state,
        stateCode: gstStateCode(state),
        bankName,
        bankAccountNumber,
        bankIfsc,
        bankBranch,
        upiId,
        defaultInvoiceNotes,
        invoiceNumberPrefix,
      }),
    });
    setSavingInvoicing(false);
    if (res.ok) {
      showSuccess("Invoicing settings saved.");
      await load();
    } else {
      showError("Failed to save invoicing settings.");
    }
  }

  async function handleAssetUpload(kind: "logo" | "signature", file: File) {
    const setUploading = kind === "logo" ? setUploadingLogo : setUploadingSignature;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    const uploadRes = await fetch("/api/business-settings/upload-asset", { method: "POST", body: form });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      setUploading(false);
      showError(uploadData?.error ?? `Failed to upload ${kind}.`);
      return;
    }
    const patchRes = await fetch("/api/business-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kind === "logo" ? { logoUrl: uploadData.url } : { signatureUrl: uploadData.url }),
    });
    setUploading(false);
    if (patchRes.ok) {
      showSuccess(`${kind === "logo" ? "Logo" : "Signature"} updated.`);
      await load();
    } else {
      showError(`Uploaded but failed to save the ${kind}.`);
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-xs font-medium mb-1";
  // Tailwind's preflight strips the native file-input button's default
  // browser chrome (border/background), which left it rendering as bare
  // unstyled text with no visible button — the `file:` variant restores
  // an actual clickable-looking button matching the rest of the form.
  const fileInputClass =
    "text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-[var(--color-line)] file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--color-ink)] file:transition-colors hover:file:bg-[var(--color-accent-tint)]";

  const missing = getMissingBusinessSettingsFields(settings);

  // Only a platform_admin's request ever returns more than one org's GST
  // registrations pooled together — the label is only worth showing once
  // it's actually ambiguous which org a row belongs to. The rest of this
  // page (Branding/Invoicing/Company Details) always stays scoped to the
  // viewer's own organization, so this only applies to this one section.
  const spansMultipleOrgs = new Set(registrations.map((r) => r.organization_id)).size > 1;

  return (
    <div>
      <DashboardPageHero title="Business Settings" subtitle="Required before invoices can be generated — also used on generated invoices and the customer payment page." />

      {settings?.updater?.full_name && settings.updated_at && (
        <p className="mt-2 text-xs" style={{ color: "var(--color-ink-soft)" }}>
          Last updated by {settings.updater.full_name} on {new Date(settings.updated_at).toLocaleDateString("en-IN")}
        </p>
      )}

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      {settings && (
        <div
          className="mt-3 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm"
          style={
            missing.length === 0
              ? { backgroundColor: "#d0f4db", borderColor: "#a8e6bc", color: "#116a2c" }
              : { backgroundColor: "#fde2e2", borderColor: "#f3a9a9", color: "#8a1a13" }
          }
        >
          {missing.length === 0 ? (
            <>
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Business Settings is complete — invoices can be generated.</p>
            </>
          ) : (
            <>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                <span className="font-semibold">Still missing:</span> {missing.join(", ")}. Invoice generation is blocked until these are filled in.
              </p>
            </>
          )}
        </div>
      )}

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-2">
        {/* Branding and Invoicing stacked in one column instead of each
            being its own full-height grid row — Branding is naturally
            short (two file pickers), so pairing it with Invoicing here
            fills the space that used to sit empty next to the taller
            Company Details card. */}
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
            <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>Branding</h3>
            <div className="mt-3">
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Company Logo</label>
              {settings?.logo_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={settings.logo_url} alt="Company logo" className="mb-2 h-12 w-auto" />
              )}
              <input
                type="file"
                accept="image/*"
                disabled={uploadingLogo}
                onChange={(e) => e.target.files?.[0] && handleAssetUpload("logo", e.target.files[0])}
                className={fileInputClass}
              />
            </div>
            <div className="mt-4">
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Authorized Signature</label>
              {settings?.signature_url && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={settings.signature_url} alt="Signature" className="mb-2 h-10 w-auto" />
              )}
              <input
                type="file"
                accept="image/*"
                disabled={uploadingSignature}
                onChange={(e) => e.target.files?.[0] && handleAssetUpload("signature", e.target.files[0])}
                className={fileInputClass}
              />
            </div>
          </div>

          <form onSubmit={handleSaveInvoicing} className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
            <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>Invoicing</h3>
            <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>Bank details and notes shown on every generated invoice PDF. At least one of Bank Details or UPI ID is required.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Invoice Number Prefix</label>
                <input value={invoiceNumberPrefix} onChange={(e) => setInvoiceNumberPrefix(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} placeholder="INV" />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Bank Name</label>
                <input value={bankName} onChange={(e) => setBankName(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Account Number</label>
                <input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>IFSC Code</label>
                <input value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Branch</label>
                <input value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>UPI ID</label>
                <input value={upiId} onChange={(e) => setUpiId(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} placeholder="name@bank" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Default Notes / Terms</label>
                <textarea rows={2} value={defaultInvoiceNotes} onChange={(e) => setDefaultInvoiceNotes(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} placeholder="Thank you for your business. GST once charged is non-refundable. Subject to Lucknow jurisdiction." />
              </div>
            </div>
            <button type="submit" disabled={savingInvoicing} className="mt-4 rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
              {savingInvoicing ? "Saving…" : "Save Invoicing Settings"}
            </button>
          </form>
        </div>

        <form onSubmit={handleSave} className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>Company Details</h3>
          <div className="mt-3 space-y-3">
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Address<RequiredMark /></label>
              <textarea required rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>GST Number<RequiredMark /></label>
                <input required value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>PAN Number<RequiredMark /></label>
                <input required value={panNumber} onChange={(e) => setPanNumber(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>PF Number</label>
                <input value={pfNumber} onChange={(e) => setPfNumber(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>ESIC Number</label>
                <input value={esicNumber} onChange={(e) => setEsicNumber(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>State<RequiredMark /></label>
                <StateSelect required value={state} onChange={(e) => setState(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>
                  Determines CGST+SGST vs IGST on invoices — compared against each customer&apos;s state.
                </p>
              </div>
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Financial Year Starts</label>
              <select value={fyMonth} onChange={(e) => setFyMonth(Number(e.target.value))} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{new Date(2000, m - 1).toLocaleDateString("en-IN", { month: "long" })}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} className="mt-4 rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </form>
      </div>

      <div className="mt-6 rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
        <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>Additional GST Registrations</h3>
        <p className="mt-1 text-xs" style={{ color: "var(--color-ink-soft)" }}>
          {spansMultipleOrgs
            ? "Every organization's additional GST registrations, pooled here for platform-level support — each company still manages its own from its own Business Settings page."
            : "If the company operates under more than one GSTIN (e.g. a branch in another state), add each one here — Invoice CRM lets staff pick which registration an invoice is issued under."}
        </p>
        {spansMultipleOrgs ? (
          <p className="mt-3 text-xs" style={{ color: "var(--color-ink-soft)" }}>
            Adding a new registration here isn&apos;t available in this cross-org view — there&apos;s no single company to attach it to. Open a specific organization&apos;s own Business Settings page to add one for them.
          </p>
        ) : (
          <form onSubmit={handleAddRegistration} className="mt-3 grid gap-3 sm:grid-cols-3">
            <input required placeholder="Label (e.g. Delhi Office)" value={regLabel} onChange={(e) => setRegLabel(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            <input required placeholder="GST Number" value={regGstNumber} onChange={(e) => setRegGstNumber(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            <StateSelect value={regState} onChange={(e) => setRegState(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            <button type="submit" disabled={savingRegistration} className="sm:col-span-3 rounded-full py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
              {savingRegistration ? "Adding…" : "+ Add Registration"}
            </button>
          </form>
        )}
        <div className="mt-4 space-y-2">
          {registrations.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--color-line)" }}>
              <span style={{ color: "var(--color-ink)" }}>
                {r.label} — {r.gst_number} {r.state ? `(${r.state})` : ""}
                {spansMultipleOrgs && (
                  <span className="ml-2 text-xs" style={{ color: "var(--color-ink-soft)" }}>{r.organizations?.name ?? "Unknown organization"}</span>
                )}
                {r.creator?.full_name && (
                  <span className="ml-2 text-xs" style={{ color: "var(--color-ink-soft)" }}>· Added by {r.creator.full_name}</span>
                )}
              </span>
              <button type="button" onClick={() => handleRemoveRegistration(r.id, r.label)} className="text-xs font-semibold" style={{ color: "#b42318" }}>Remove</button>
            </div>
          ))}
          {registrations.length === 0 && <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>No additional registrations — invoices use the default GST number above.</p>}
        </div>
      </div>
    </div>
  );
}
