"use client";

import { useEffect, useState } from "react";
import { X, Upload } from "lucide-react";
import { DetailPickerModal } from "@/components/DetailPickerModal";
import { RequiredMark } from "@/components/RequiredMark";

type Account = { id: string; bank_name: string; account_name: string };
type Category = { id: string; name: string };

export type EditableTransaction = {
  id: string;
  transaction_date: string;
  category_id: string | null;
  description: string | null;
  amount: number;
  payment_mode: "bank" | "cash" | "upi" | "cheque" | "card";
  account_id: string | null;
  reference_number: string | null;
  party_name: string | null;
  gstin: string | null;
  document_number: string | null;
  gst_applicable: boolean;
  taxable_value: number | null;
  cgst: number | null;
  sgst: number | null;
  igst: number | null;
  tds_applicable: boolean;
  tds_section: string | null;
  tds_rate: number | null;
  tds_amount: number | null;
  notes: string | null;
};

const PAYMENT_MODES = [
  { value: "bank", label: "Bank" },
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
];

// Module 3 (expense) and Module 4 (income) share this one form — the
// fields overlap enough (date, category, amount, payment mode, party,
// document number, GST) that two near-identical modals would just be
// duplicated markup drifting out of sync over time.
// Editing reuses this same form (same fields either direction) rather
// than a separate component — pass `editing` and it pre-fills from that
// row, submits a PATCH instead of a POST, and drops "Save & New" (there's
// no "next one" when you're correcting a single existing entry). Give it
// a `key={editing.id}` from the caller so React remounts fresh state per
// transaction rather than reusing stale field values across edits.
export function AddTransactionModal({
  transactionType,
  accounts,
  bookOwnerId,
  editing,
  onClose,
  onSaved,
}: {
  transactionType: "expense" | "income";
  accounts: Account[];
  bookOwnerId: string;
  editing?: EditableTransaction;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  const [date, setDate] = useState(editing?.transaction_date ?? new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [paymentMode, setPaymentMode] = useState<"bank" | "cash" | "upi" | "cheque" | "card">(editing?.payment_mode ?? "bank");
  const [accountId, setAccountId] = useState(editing?.account_id ?? accounts[0]?.id ?? "");
  const [referenceNumber, setReferenceNumber] = useState(editing?.reference_number ?? "");
  const [partyName, setPartyName] = useState(editing?.party_name ?? "");
  const [gstin, setGstin] = useState(editing?.gstin ?? "");
  const [documentNumber, setDocumentNumber] = useState(editing?.document_number ?? "");
  const [gstApplicable, setGstApplicable] = useState(editing?.gst_applicable ?? false);
  const [taxableValue, setTaxableValue] = useState(editing?.taxable_value != null ? String(editing.taxable_value) : "");
  const [cgst, setCgst] = useState(editing?.cgst != null ? String(editing.cgst) : "");
  const [sgst, setSgst] = useState(editing?.sgst != null ? String(editing.sgst) : "");
  const [igst, setIgst] = useState(editing?.igst != null ? String(editing.igst) : "");
  const [tdsApplicable, setTdsApplicable] = useState(editing?.tds_applicable ?? false);
  const [tdsSection, setTdsSection] = useState(editing?.tds_section ?? "");
  const [tdsRate, setTdsRate] = useState(editing?.tds_rate != null ? String(editing.tds_rate) : "");
  const [tdsAmount, setTdsAmount] = useState(editing?.tds_amount != null ? String(editing.tds_amount) : "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadCategories() {
    const res = await fetch(`/api/expense-manager/categories?type=${transactionType}&bookOwnerId=${bookOwnerId}`);
    const data = await res.json();
    if (res.ok) setCategories(data.categories ?? []);
  }

  useEffect(() => {
    // Deferred — same pattern used elsewhere in this codebase to avoid
    // the cascading-render lint rule.
    const kickoff = setTimeout(loadCategories, 0);
    return () => clearTimeout(kickoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    const res = await fetch("/api/expense-manager/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookOwnerId, name: newCategoryName.trim(), transactionType }),
    });
    const data = await res.json();
    if (res.ok) {
      setCategories((prev) => [...prev, data.category].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(data.category.id);
      setNewCategoryName("");
      setAddingCategory(false);
    }
  }

  function resetForm() {
    setDate(new Date().toISOString().slice(0, 10));
    setCategoryId("");
    setDescription("");
    setAmount("");
    setReferenceNumber("");
    setPartyName("");
    setGstin("");
    setDocumentNumber("");
    setGstApplicable(false);
    setTaxableValue("");
    setCgst("");
    setSgst("");
    setIgst("");
    setTdsApplicable(false);
    setTdsSection("");
    setTdsRate("");
    setTdsAmount("");
    setNotes("");
    setFile(null);
  }

  async function handleSubmit(closeAfter: boolean) {
    if (!date) {
      setError("Date is required.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!categoryId) {
      setError("Choose a category.");
      return;
    }
    if (paymentMode !== "cash" && !accountId) {
      setError("Choose a bank account, or switch payment mode to Cash.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const url = editing ? `/api/expense-manager/transactions/${editing.id}` : "/api/expense-manager/transactions";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookOwnerId,
        transactionType,
        transactionDate: date,
        categoryId: categoryId || undefined,
        description: description || undefined,
        amount: Number(amount),
        paymentMode,
        accountId: paymentMode === "cash" ? undefined : accountId,
        referenceNumber: referenceNumber || undefined,
        partyName: partyName || undefined,
        gstin: gstin || undefined,
        documentNumber: documentNumber || undefined,
        gstApplicable,
        taxableValue: gstApplicable && taxableValue ? Number(taxableValue) : undefined,
        cgst: gstApplicable && cgst ? Number(cgst) : undefined,
        sgst: gstApplicable && sgst ? Number(sgst) : undefined,
        igst: gstApplicable && igst ? Number(igst) : undefined,
        tdsApplicable: transactionType === "expense" ? tdsApplicable : undefined,
        tdsSection: transactionType === "expense" && tdsApplicable && tdsSection ? tdsSection : undefined,
        tdsRate: transactionType === "expense" && tdsApplicable && tdsRate ? Number(tdsRate) : undefined,
        tdsAmount: transactionType === "expense" && tdsApplicable && tdsAmount ? Number(tdsAmount) : undefined,
        notes: notes || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setSubmitting(false);
      setError(data.error ?? "Failed to save.");
      return;
    }

    if (file) {
      const form = new FormData();
      form.append("file", file);
      await fetch(`/api/expense-manager/transactions/${data.transaction.id}/documents`, { method: "POST", body: form });
    }

    setSubmitting(false);
    onSaved();
    if (closeAfter) {
      onClose();
    } else {
      resetForm();
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-sm font-medium mb-1";
  const partyLabel = transactionType === "expense" ? "Vendor Name" : "Customer";
  const documentLabel = transactionType === "expense" ? "Bill Number" : "Invoice Number";

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" style={{ backgroundColor: "rgba(15,23,42,0.45)" }}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 dark:bg-[var(--color-paper-raised)]" style={{ border: "1px solid var(--color-line)" }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
            {editing ? "Edit " : "Add "}{transactionType === "expense" ? "Expense" : "Income"}
          </h3>
          <div className="flex items-center gap-3">
            <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>
              <span style={{ color: "var(--color-danger)" }}>*</span> Required
            </p>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 transition-colors hover:bg-[var(--color-accent-tint)]">
              <X className="h-4 w-4" style={{ color: "var(--color-ink-soft)" }} />
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Date<RequiredMark /></label>
            <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Category<RequiredMark /></label>
            {addingCategory ? (
              <div className="flex gap-2">
                <input autoFocus value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New category" className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                <button type="button" onClick={handleAddCategory} className="shrink-0 rounded-lg px-3 text-sm font-semibold text-white" style={{ backgroundColor: "var(--color-action)" }}>Add</button>
              </div>
            ) : (
              <DetailPickerModal
                value={categoryId}
                onChange={(v) => (v === "__new__" ? setAddingCategory(true) : setCategoryId(v))}
                placeholder="Select a category"
                options={[
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                  { value: "__new__", label: "+ Add new category…" },
                ]}
              />
            )}
          </div>

          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Amount<RequiredMark /></label>
            <input type="number" min={0.01} step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Payment Mode<RequiredMark /></label>
            <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as typeof paymentMode)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {paymentMode !== "cash" && (
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink)" }}>Bank<RequiredMark /></label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                <option value="">Select an account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.bank_name} — {a.account_name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Reference Number</label>
            <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>

          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>{partyLabel}</label>
            <input value={partyName} onChange={(e) => setPartyName(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
          <div>
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>{documentLabel}</label>
            <input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <input id="gstApplicable" type="checkbox" checked={gstApplicable} onChange={(e) => setGstApplicable(e.target.checked)} className="h-4 w-4" />
            <label htmlFor="gstApplicable" className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>GST applicable</label>
          </div>

          {gstApplicable && (
            <>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>GSTIN</label>
                <input value={gstin} onChange={(e) => setGstin(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>Taxable Value</label>
                <input type="number" min={0} step="0.01" value={taxableValue} onChange={(e) => setTaxableValue(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>CGST</label>
                <input type="number" min={0} step="0.01" value={cgst} onChange={(e) => setCgst(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>SGST</label>
                <input type="number" min={0} step="0.01" value={sgst} onChange={(e) => setSgst(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>IGST</label>
                <input type="number" min={0} step="0.01" value={igst} onChange={(e) => setIgst(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
            </>
          )}

          {transactionType === "expense" && (
            <div className="sm:col-span-2 flex items-center gap-2">
              <input id="tdsApplicable" type="checkbox" checked={tdsApplicable} onChange={(e) => setTdsApplicable(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="tdsApplicable" className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>TDS deducted on this payment</label>
            </div>
          )}

          {transactionType === "expense" && tdsApplicable && (
            <>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>TDS Section</label>
                <input placeholder="e.g. 194C, 194J" value={tdsSection} onChange={(e) => setTdsSection(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>TDS Rate (%)</label>
                <input type="number" min={0} step="0.01" value={tdsRate} onChange={(e) => setTdsRate(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink)" }}>TDS Amount</label>
                <input type="number" min={0} step="0.01" value={tdsAmount} onChange={(e) => setTdsAmount(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Upload Bill / Invoice</label>
            <label
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
            >
              <Upload className="h-3.5 w-3.5" />
              {file ? file.name : "Choose File"}
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} style={{ color: "var(--color-ink)" }}>Notes</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          </div>
        </div>

        {error && <p className="mt-3 text-sm" style={{ color: "var(--color-danger)" }}>{error}</p>}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit(true)}
            className="rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            {submitting ? "Saving…" : "Save"}
          </button>
          {!editing && (
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(false)}
              className="rounded-full border px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
            >
              Save &amp; New
            </button>
          )}
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-full border px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
