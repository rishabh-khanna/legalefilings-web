"use client";

import { useEffect, useState } from "react";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero } from "@/components/crm/DashboardPageHero";

type Settings = {
  logo_url: string | null;
  signature_url: string | null;
  address: string | null;
  gst_number: string | null;
  pan_number: string | null;
  pf_number: string | null;
  esic_number: string | null;
  financial_year_start_month: number;
};

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [address, setAddress] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [pfNumber, setPfNumber] = useState("");
  const [esicNumber, setEsicNumber] = useState("");
  const [fyMonth, setFyMonth] = useState(4);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const { message, showSuccess, showError } = useActionMessage();

  async function load() {
    const res = await fetch("/api/company-settings");
    const data = await res.json();
    if (res.ok && data.settings) {
      setSettings(data.settings);
      setAddress(data.settings.address ?? "");
      setGstNumber(data.settings.gst_number ?? "");
      setPanNumber(data.settings.pan_number ?? "");
      setPfNumber(data.settings.pf_number ?? "");
      setEsicNumber(data.settings.esic_number ?? "");
      setFyMonth(data.settings.financial_year_start_month ?? 4);
    }
  }

  useEffect(() => {
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/company-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, gstNumber, panNumber, pfNumber, esicNumber, financialYearStartMonth: fyMonth }),
    });
    setSaving(false);
    if (res.ok) {
      showSuccess("Settings saved.");
      await load();
    } else {
      showError("Failed to save settings.");
    }
  }

  async function handleAssetUpload(kind: "logo" | "signature", file: File) {
    const setUploading = kind === "logo" ? setUploadingLogo : setUploadingSignature;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    const uploadRes = await fetch("/api/company-settings/upload-asset", { method: "POST", body: form });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      setUploading(false);
      showError(uploadData?.error ?? `Failed to upload ${kind}.`);
      return;
    }
    const patchRes = await fetch("/api/company-settings", {
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

  return (
    <div>
      <DashboardPageHero title="Company Settings" subtitle="Used on generated payslips, letters, and invoices." />

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
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
              className="text-sm"
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
              className="text-sm"
            />
          </div>
        </div>

        <form onSubmit={handleSave} className="rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <h3 className="font-semibold" style={{ color: "var(--color-ink)" }}>Company Details</h3>
          <div className="mt-3 space-y-3">
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Address</label>
              <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>GST Number</label>
                <input value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>PAN Number</label>
                <input value={panNumber} onChange={(e) => setPanNumber(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>PF Number</label>
                <input value={pfNumber} onChange={(e) => setPfNumber(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>ESIC Number</label>
                <input value={esicNumber} onChange={(e) => setEsicNumber(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
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
          <button type="submit" disabled={saving} className="mt-4 rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </form>
      </div>
    </div>
  );
}
