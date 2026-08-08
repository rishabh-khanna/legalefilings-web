"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { FileText, CheckCircle2, Clock, IndianRupee, ChevronLeft, ChevronRight, Trash2, Paperclip, History, Repeat, Download, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isStaffOrAdmin, type Profile } from "@/lib/roles";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { StateSelect } from "@/components/StateSelect";
import { RequiredMark } from "@/components/RequiredMark";
import { computeInvoiceTotals, type LineItemDraft } from "@/lib/invoice-calc";
import { gstStateCode } from "@/lib/gst-state-codes";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { SITE_NAME } from "@/config/site";
import { LoadingBlock } from "@/components/Spinner";
import { usePagination } from "@/lib/use-pagination";
import { TablePagination } from "@/components/TablePagination";
import { useDateRangeFilter } from "@/lib/use-date-range-filter";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ExportButton } from "@/components/ExportButton";

type InvoiceType = "gst" | "non_gst" | "export" | "proforma" | "credit_note" | "debit_note";
type InvoiceRow = {
  id: string;
  invoice_number: string;
  invoice_type: InvoiceType;
  order_id: string | null;
  status: "draft" | "sent" | "paid" | "partially_paid" | "overdue" | "cancelled";
  total: number;
  created_at: string;
  due_at: string | null;
  customer_id: string;
  profiles?: { full_name: string | null; company: string | null } | null;
  invoice_payments?: { amount: number }[];
};
type CatalogItem = { id: string; type: "product" | "service"; name: string; hsn_sac_code: string | null; gst_rate: number; unit: string; default_rate: number | null };
type Customer = {
  id: string; full_name: string | null; company: string | null; phone: string | null;
  gstin: string | null; pan_number: string | null; state: string | null; state_code: string | null;
  billing_address: string | null; shipping_address: string | null;
};
type GstRegistration = { id: string; label: string; gst_number: string; state: string | null; state_code: string | null; is_default: boolean };
type WizardItem = { catalogItemId: string; description: string; itemType: "product" | "service"; hsnSacCode: string; unit: string; quantity: string; rate: string; discount: string; gstRate: string };
type RecurringTemplate = { id: string; frequency: string; next_run_date: string; active: boolean; invoice_type: string; profiles?: { full_name: string | null } | null; payload: Record<string, unknown> };
type LedgerEntry = { date: string; type: "invoice" | "payment"; label: string; debit: number; credit: number; balance: number; invoiceNumber: string };

const TYPE_LABEL: Record<InvoiceType, string> = {
  gst: "GST Invoice", non_gst: "Non-GST Invoice", export: "Export Invoice",
  proforma: "Proforma Invoice", credit_note: "Credit Note", debit_note: "Debit Note",
};
const STATUS_STYLE: Record<InvoiceRow["status"], { bg: string; fg: string }> = {
  draft: { bg: "var(--color-paper)", fg: "var(--color-ink-soft)" },
  sent: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  paid: { bg: "#d0f4db", fg: "#116a2c" },
  partially_paid: { bg: "#fff6d9", fg: "#8a6700" },
  overdue: { bg: "#fde2e2", fg: "#b42318" },
  cancelled: { bg: "var(--color-paper)", fg: "var(--color-ink-soft)" },
};
const EMPTY_ITEM: WizardItem = { catalogItemId: "", description: "", itemType: "service", hsnSacCode: "", unit: "Nos", quantity: "1", rate: "", discount: "0", gstRate: "18" };
const EMPTY_NEW_CUSTOMER = { fullName: "", email: "", phone: "", company: "", gstin: "", panNumber: "", state: "", billingAddress: "", shippingAddress: "" };
const WIZARD_STEPS = ["Type", "Customer", "Details", "Items", "Charges & TDS", "Terms & Notes", "Preview"];

export default function InvoiceCrmPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<InvoiceRow["status"] | "all">("all");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [registrations, setRegistrations] = useState<GstRegistration[]>([]);
  const [companyStateCode, setCompanyStateCode] = useState("");
  const [view, setView] = useState<"invoices" | "recurring">("invoices");
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const { message, showSuccess, showError } = useActionMessage();

  // Wizard state
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>("gst");
  const [relatedInvoiceId, setRelatedInvoiceId] = useState("");
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState(EMPTY_NEW_CUSTOMER);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [custGstin, setCustGstin] = useState("");
  const [custPan, setCustPan] = useState("");
  const [custState, setCustState] = useState("");
  const [custBilling, setCustBilling] = useState("");
  const [custShipping, setCustShipping] = useState("");
  const [placeOfSupply, setPlaceOfSupply] = useState("");
  const [reverseCharge, setReverseCharge] = useState(false);
  const [gstRegistrationId, setGstRegistrationId] = useState("");
  const [pdfTemplate, setPdfTemplate] = useState<"classic" | "modern">("classic");
  const [items, setItems] = useState<WizardItem[]>([{ ...EMPTY_ITEM }]);
  const [discountType, setDiscountType] = useState<"" | "flat" | "percentage">("");
  const [discountValue, setDiscountValue] = useState("0");
  const [freight, setFreight] = useState("0");
  const [packing, setPacking] = useState("0");
  const [courier, setCourier] = useState("0");
  const [otherCharges, setOtherCharges] = useState("0");
  const [tdsRate, setTdsRate] = useState("0");
  const [paymentTerms, setPaymentTerms] = useState("Immediate");
  const [customDays, setCustomDays] = useState("45");
  const [notes, setNotes] = useState("");

  const [payingInvoice, setPayingInvoice] = useState<InvoiceRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState("Bank Transfer");
  const [payTxnId, setPayTxnId] = useState("");
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [savingRecurring, setSavingRecurring] = useState(false);

  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [expandedTab, setExpandedTab] = useState<"attachments" | "history">("attachments");
  const [attachments, setAttachments] = useState<{ id: string; file_name: string }[]>([]);
  const [history, setHistory] = useState<{ id: string; event_type: string; detail: string | null; created_at: string; profiles?: { full_name: string | null } | null }[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const [ledgerCustomerId, setLedgerCustomerId] = useState("");
  const [ledger, setLedger] = useState<LedgerEntry[] | null>(null);
  const [ledgerOutstanding, setLedgerOutstanding] = useState(0);

  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>([]);
  const [recurringFrequency, setRecurringFrequency] = useState("monthly");
  const [runningTemplateId, setRunningTemplateId] = useState<string | null>(null);

  async function loadInvoices() {
    const res = await fetch("/api/invoices");
    const data = await res.json();
    setInvoices(((data.invoices as InvoiceRow[] | undefined) ?? []).filter((i) => !i.order_id));
  }

  async function loadRecurring() {
    const res = await fetch("/api/recurring-invoices");
    if (res.ok) setRecurringTemplates((await res.json()).templates ?? []);
  }

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (p) setProfile({ ...p, email: user.email ?? "" });
      if (!p || !isStaffOrAdmin(p)) {
        setLoading(false);
        return;
      }

      await loadInvoices();
      await loadRecurring();
      const [custRes, catalogRes, settingsRes, regRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/product-service-master"),
        fetch("/api/business-settings"),
        fetch("/api/company-gst-registrations"),
      ]);
      setCustomers(((await custRes.json()).customers as Customer[] | undefined) ?? []);
      setCatalog(((await catalogRes.json()).items as CatalogItem[] | undefined) ?? []);
      const settingsData = await settingsRes.json();
      setCompanyStateCode(settingsData.settings?.state_code ?? "");
      if (settingsData.settings?.default_invoice_notes) setNotes(settingsData.settings.default_invoice_notes);
      setRegistrations(((await regRes.json()).registrations as GstRegistration[] | undefined) ?? []);
      setLoading(false);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  function handleSelectCustomer(id: string) {
    setCustomerId(id);
    const found = customers.find((c) => c.id === id);
    if (!found) return;
    setCustGstin(found.gstin ?? "");
    setCustPan(found.pan_number ?? "");
    setCustState(found.state ?? "");
    setCustBilling(found.billing_address ?? "");
    setCustShipping(found.shipping_address ?? "");
    setPlaceOfSupply(found.state ?? "");
  }

  function updateItem(index: number, patch: Partial<WizardItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function pickCatalogItem(index: number, catalogItemId: string) {
    const found = catalog.find((c) => c.id === catalogItemId);
    if (!found) {
      updateItem(index, { catalogItemId: "" });
      return;
    }
    updateItem(index, {
      catalogItemId,
      description: found.name,
      itemType: found.type,
      hsnSacCode: found.hsn_sac_code ?? "",
      unit: found.unit,
      gstRate: String(found.gst_rate),
      rate: found.default_rate != null ? String(found.default_rate) : items[index].rate,
    });
  }

  const effectiveCompanyStateCode = registrations.find((r) => r.id === gstRegistrationId)?.state_code || companyStateCode;
  const isIntraState = !!effectiveCompanyStateCode && effectiveCompanyStateCode === gstStateCode(custState);
  const taxable = invoiceType === "gst" || invoiceType === "credit_note" || invoiceType === "debit_note";
  const resolvedPaymentTerms = paymentTerms === "Custom" ? `${customDays || 0} Days` : paymentTerms;

  const lineItemDrafts: LineItemDraft[] = useMemo(
    () =>
      items
        .filter((i) => i.description && i.rate)
        .map((i) => ({
          description: i.description, hsnSacCode: i.hsnSacCode, itemType: i.itemType, unit: i.unit,
          quantity: Number(i.quantity) || 0, rate: Number(i.rate) || 0, discount: Number(i.discount) || 0, gstRate: Number(i.gstRate) || 0,
        })),
    [items]
  );

  const totals = useMemo(
    () =>
      computeInvoiceTotals({
        items: lineItemDrafts, isIntraState, taxable,
        discountType: discountType || null, discountValue: Number(discountValue) || 0,
        freight: Number(freight) || 0, packing: Number(packing) || 0, courier: Number(courier) || 0, otherCharges: Number(otherCharges) || 0,
        tdsRate: Number(tdsRate) || 0,
      }),
    [lineItemDrafts, isIntraState, taxable, discountType, discountValue, freight, packing, courier, otherCharges, tdsRate]
  );

  function resetWizard() {
    setEditingInvoiceId(null);
    setStep(1);
    setInvoiceType("gst");
    setRelatedInvoiceId("");
    setCustomerMode("existing");
    setCustomerId("");
    setNewCustomer(EMPTY_NEW_CUSTOMER);
    setCustGstin("");
    setCustPan("");
    setCustState("");
    setCustBilling("");
    setCustShipping("");
    setPlaceOfSupply("");
    setReverseCharge(false);
    setGstRegistrationId("");
    setPdfTemplate("classic");
    setItems([{ ...EMPTY_ITEM }]);
    setDiscountType("");
    setDiscountValue("0");
    setFreight("0");
    setPacking("0");
    setCourier("0");
    setOtherCharges("0");
    setTdsRate("0");
    setPaymentTerms("Immediate");
  }

  async function handleEditDraft(inv: InvoiceRow) {
    const res = await fetch(`/api/invoices/${inv.id}`);
    if (!res.ok) {
      showError("Failed to load invoice for editing.");
      return;
    }
    const data = await res.json();
    const full = data.invoice;
    resetWizard();
    setEditingInvoiceId(inv.id);
    setInvoiceType(full.invoice_type);
    setRelatedInvoiceId(full.related_invoice_id ?? "");
    setCustomerId(full.customer_id);
    setCustGstin(full.customer_gstin ?? "");
    setCustPan(full.customer_pan ?? "");
    setCustState(full.customer_state ?? "");
    setCustBilling(full.customer_billing_address ?? "");
    setCustShipping(full.customer_shipping_address ?? "");
    setPlaceOfSupply(full.place_of_supply ?? "");
    setReverseCharge(full.reverse_charge);
    setGstRegistrationId(full.gst_registration_id ?? "");
    setPdfTemplate(full.pdf_template ?? "classic");
    setItems(
      (full.invoice_line_items ?? []).map((li: Record<string, unknown>) => ({
        catalogItemId: li.catalog_item_id ?? "",
        description: li.description,
        itemType: li.item_type,
        hsnSacCode: li.hsn_sac_code ?? "",
        unit: li.unit,
        quantity: String(li.quantity),
        rate: String(li.unit_price),
        discount: String(li.discount),
        gstRate: String(li.gst_rate),
      }))
    );
    setDiscountType(full.discount_type ?? "");
    setDiscountValue(String(full.discount_value ?? 0));
    setFreight(String(full.freight ?? 0));
    setPacking(String(full.packing ?? 0));
    setCourier(String(full.courier ?? 0));
    setOtherCharges(String(full.other_charges ?? 0));
    setTdsRate(String(full.tds_rate ?? 0));
    setPaymentTerms(full.payment_terms ?? "Immediate");
    setNotes(full.notes ?? "");
    setShowWizard(true);
  }

  async function handleCreateCustomer() {
    if (!newCustomer.fullName || !newCustomer.email) {
      showError("Name and email are required to add a new customer.");
      return;
    }
    setCreatingCustomer(true);
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: newCustomer.fullName, email: newCustomer.email, phone: newCustomer.phone, accountType: "customer", customerTier: "free",
        company: newCustomer.company, state: newCustomer.state, gstin: newCustomer.gstin, panNumber: newCustomer.panNumber,
        stateCode: gstStateCode(newCustomer.state), billingAddress: newCustomer.billingAddress, shippingAddress: newCustomer.shippingAddress,
      }),
    });
    const data = await res.json();
    setCreatingCustomer(false);
    if (res.ok) {
      const custRes = await fetch("/api/customers");
      const custData = await custRes.json();
      setCustomers((custData.customers as Customer[] | undefined) ?? []);
      setCustomerId(data.userId);
      setCustomerMode("existing");
      setCustGstin(newCustomer.gstin);
      setCustPan(newCustomer.panNumber);
      setCustState(newCustomer.state);
      setCustBilling(newCustomer.billingAddress);
      setCustShipping(newCustomer.shippingAddress);
      setPlaceOfSupply(newCustomer.state);
      showSuccess(`Customer added. Temp password (share securely): ${data.tempPassword}`);
    } else {
      showError(data?.error ?? "Failed to add customer.");
    }
  }

  function buildPayload() {
    return {
      invoiceType,
      relatedInvoiceId: relatedInvoiceId || undefined,
      customerId,
      placeOfSupply,
      reverseCharge,
      gstRegistrationId: gstRegistrationId || undefined,
      pdfTemplate,
      items: items
        .filter((i) => i.description && i.rate)
        .map((i) => ({
          catalogItemId: i.catalogItemId || undefined, description: i.description, itemType: i.itemType, hsnSacCode: i.hsnSacCode, unit: i.unit,
          quantity: Number(i.quantity) || 0, rate: Number(i.rate) || 0, discount: Number(i.discount) || 0, gstRate: Number(i.gstRate) || 0,
        })),
      discountType: discountType || null,
      discountValue: Number(discountValue) || 0,
      freight: Number(freight) || 0,
      packing: Number(packing) || 0,
      courier: Number(courier) || 0,
      otherCharges: Number(otherCharges) || 0,
      tdsRate: Number(tdsRate) || 0,
      paymentTerms: resolvedPaymentTerms,
      notes,
      customerGstin: custGstin || undefined,
      customerPan: custPan || undefined,
      customerState: custState || undefined,
      customerStateCode: gstStateCode(custState) || undefined,
      customerBillingAddress: custBilling || undefined,
      customerShippingAddress: custShipping || undefined,
    };
  }

  async function handlePreviewPdf() {
    if (!customerId || lineItemDrafts.length === 0) {
      showError("Select a customer and add at least one item first.");
      return;
    }
    setPreviewing(true);
    const res = await fetch("/api/invoices/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    setPreviewing(false);
    if (!res.ok) {
      showError("Failed to build preview.");
      return;
    }
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), "_blank");
  }

  async function handleGenerate() {
    if (!customerId) {
      showError("Select a customer first.");
      return;
    }
    if (taxable && !placeOfSupply.trim()) {
      showError("Place of Supply is required for taxable invoices — it drives CGST+SGST vs IGST.");
      return;
    }
    if (lineItemDrafts.length === 0) {
      showError("Add at least one line item.");
      return;
    }
    if (lineItemDrafts.some((i) => !(i.quantity > 0))) {
      showError("Every line item needs a quantity greater than 0.");
      return;
    }
    setGenerating(true);
    const res = editingInvoiceId
      ? await fetch(`/api/invoices/${editingInvoiceId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()) })
      : await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()) });
    setGenerating(false);
    if (res.ok) {
      await loadInvoices();
      resetWizard();
      setShowWizard(false);
      showSuccess(editingInvoiceId ? "Draft updated." : "Invoice generated.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to save invoice.");
    }
  }

  async function handleRecordPayment() {
    if (!payingInvoice || !payAmount) return;
    setRecordingPayment(true);
    const res = await fetch(`/api/invoices/${payingInvoice.id}/record-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Number(payAmount), paymentMode: payMode, transactionId: payTxnId || undefined }),
    });
    setRecordingPayment(false);
    if (res.ok) {
      await loadInvoices();
      setPayingInvoice(null);
      setPayAmount("");
      setPayTxnId("");
      showSuccess("Payment recorded.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to record payment.");
    }
  }

  async function handleSend(id: string) {
    const res = await fetch(`/api/invoices/${id}/send`, { method: "POST" });
    if (res.ok) {
      await loadInvoices();
      showSuccess("Marked as sent.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to send.");
    }
  }

  async function handleEmail(id: string) {
    const res = await fetch(`/api/invoices/${id}/send-email`, { method: "POST" });
    if (res.ok) {
      await loadInvoices();
      showSuccess("Emailed to customer.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to send email.");
    }
  }

  async function toggleExpand(inv: InvoiceRow, tab: "attachments" | "history") {
    if (expandedInvoiceId === inv.id && expandedTab === tab) {
      setExpandedInvoiceId(null);
      return;
    }
    setExpandedInvoiceId(inv.id);
    setExpandedTab(tab);
    if (tab === "attachments") {
      const res = await fetch(`/api/invoices/${inv.id}/attachments`);
      if (res.ok) setAttachments((await res.json()).attachments ?? []);
    } else {
      const res = await fetch(`/api/invoices/${inv.id}/history`);
      if (res.ok) setHistory((await res.json()).history ?? []);
    }
  }

  async function handleUploadAttachment(invoiceId: string, file: File) {
    setUploadingAttachment(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/invoices/${invoiceId}/attachments`, { method: "POST", body: form });
    setUploadingAttachment(false);
    if (res.ok) {
      const listRes = await fetch(`/api/invoices/${invoiceId}/attachments`);
      if (listRes.ok) setAttachments((await listRes.json()).attachments ?? []);
      showSuccess("Attachment uploaded.");
    } else {
      showError("Failed to upload attachment.");
    }
  }

  async function loadLedger(id: string) {
    setLedgerCustomerId(id);
    if (!id) {
      setLedger(null);
      return;
    }
    const res = await fetch(`/api/invoices/ledger?customerId=${id}`);
    if (res.ok) {
      const data = await res.json();
      setLedger(data.ledger ?? []);
      setLedgerOutstanding(data.totalOutstanding ?? 0);
    }
  }

  async function handleCreateRecurring() {
    if (!customerId || lineItemDrafts.length === 0) {
      showError("Select a customer and add items first.");
      return;
    }
    if (savingRecurring) return;
    setSavingRecurring(true);
    const res = await fetch("/api/recurring-invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, invoiceType, frequency: recurringFrequency, payload: buildPayload() }),
    });
    setSavingRecurring(false);
    if (res.ok) {
      await loadRecurring();
      resetWizard();
      setShowWizard(false);
      showSuccess("Recurring invoice template saved.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to save template.");
    }
  }

  async function handleRunTemplate(id: string) {
    setRunningTemplateId(id);
    const res = await fetch(`/api/recurring-invoices/run?templateId=${id}`);
    setRunningTemplateId(null);
    if (res.ok) {
      await Promise.all([loadRecurring(), loadInvoices()]);
      showSuccess("Invoice generated from template.");
    } else {
      showError("Failed to run template.");
    }
  }

  function balanceOf(inv: InvoiceRow) {
    const paid = (inv.invoice_payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);
    return Math.max(0, Number(inv.total) - paid);
  }

  const canManage = profile ? isStaffOrAdmin(profile) : false;
  const activeStepLabels = WIZARD_STEPS;
  const currentStepLabel = activeStepLabels[Math.min(step, activeStepLabels.length) - 1];
  const invoiceStats = useMemo(() => {
    const paid = invoices.filter((i) => i.status === "paid").length;
    const totalValue = invoices.filter((i) => i.status !== "cancelled").reduce((sum, i) => sum + Number(i.total), 0);
    return { total: invoices.length, paid, pending: invoices.length - paid, totalValue };
  }, [invoices]);

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-xs font-medium mb-1";

  const filteredInvoices = useMemo(
    () => (invoiceStatusFilter === "all" ? invoices : invoices.filter((i) => i.status === invoiceStatusFilter)),
    [invoices, invoiceStatusFilter]
  );
  const invoiceDateFilter = useDateRangeFilter(filteredInvoices, (i) => i.created_at);
  const ledgerDateFilter = useDateRangeFilter(ledger ?? [], (e) => e.date);
  const invoicesPagination = usePagination(invoiceDateFilter.filtered);
  const ledgerPagination = usePagination(ledgerDateFilter.filtered);
  const recurringDateFilter = useDateRangeFilter(recurringTemplates, (t) => t.next_run_date);
  const recurringPagination = usePagination(recurringDateFilter.filtered);

  if (loading) {
    return <LoadingBlock />;
  }

  if (!canManage) {
    return (
      <div>
        <DashboardPageHero title="Invoice CRM" subtitle="Staff and admin only." />
        <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>You don&apos;t have access to this page. See your invoices under Order Invoices instead.</p>
      </div>
    );
  }

  const gstOriginalInvoices = invoices.filter((i) => i.invoice_type === "gst" || i.invoice_type === "non_gst");

  return (
    <div>
      <DashboardPageHero title="Invoice CRM" subtitle="GST-compliant ad-hoc invoicing — products, services, credit/debit notes, recurring billing, and payment tracking.">
        <div className="relative mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <HeroKpi icon={FileText} label="Total" value={invoiceStats.total} />
          <HeroKpi icon={CheckCircle2} label="Paid" value={invoiceStats.paid} />
          <HeroKpi icon={Clock} label="Pending" value={invoiceStats.pending} />
          <HeroKpi icon={IndianRupee} label="Total Value" value={`₹${invoiceStats.totalValue.toLocaleString("en-IN")}`} />
        </div>
      </DashboardPageHero>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-full border p-1" style={{ borderColor: "var(--color-line)" }}>
          {([["invoices", "Invoices"], ["recurring", "Recurring"]] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setView(value)} className="rounded-full px-4 py-2 text-sm font-semibold transition-colors" style={view === value ? { backgroundColor: "var(--color-accent)", color: "var(--color-ink)" } : { color: "var(--color-ink-soft)" }}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a href={`/api/invoices/export?origin=billed`} className="flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium" style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}>
            <Download className="h-4 w-4" /> Export CSV
          </a>
          <button
            type="button"
            onClick={() => {
              if (showWizard) resetWizard();
              setShowWizard((v) => !v);
              setView("invoices");
            }}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            {showWizard ? "Cancel" : "+ Generate Invoice"}
          </button>
        </div>
      </div>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      {showWizard && (
        // A full-screen overlay of its own, not a card squeezed into the
        // same flow as the invoice list below it — a 7-step wizard needs
        // real room, and competing for space with the list/tabs above it
        // was exactly what made it read as cramped.
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4" style={{ backgroundColor: "rgba(15,23,42,0.45)" }}>
        <div className="my-auto w-full max-w-4xl rounded-2xl border bg-white p-6 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>
              {editingInvoiceId ? "Edit Invoice" : "Generate Invoice"}
            </h2>
            <button
              type="button"
              onClick={() => {
                resetWizard();
                setShowWizard(false);
                setView("invoices");
              }}
              aria-label="Close"
              className="rounded-full p-1.5 transition-colors hover:bg-[var(--color-accent-tint)]"
            >
              <X className="h-4 w-4" style={{ color: "var(--color-ink-soft)" }} />
            </button>
          </div>
          {editingInvoiceId && (
            <p className="mb-4 rounded-lg px-3 py-2 text-xs font-medium" style={{ backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}>
              Editing draft invoice — changes replace it when you generate.
            </p>
          )}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {activeStepLabels.map((label, i) => {
              const stepNum = i + 1;
              const active = stepNum === step;
              return (
                <button key={label} type="button" onClick={() => setStep(stepNum)} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={active ? { backgroundColor: "var(--color-accent)", color: "var(--color-ink)" } : { backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}>
                    {stepNum}
                  </span>
                  <span className="text-xs font-medium" style={{ color: active ? "var(--color-ink)" : "var(--color-ink-soft)" }}>{label}</span>
                </button>
              );
            })}
          </div>

          {currentStepLabel === "Type" && (
            <div>
              <p className={labelClass} style={{ color: "var(--color-ink-soft)" }}>What kind of invoice is this?</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(Object.keys(TYPE_LABEL) as InvoiceType[]).map((t) => (
                  <button key={t} type="button" onClick={() => setInvoiceType(t)} className="rounded-xl border p-3 text-left text-sm font-medium transition-colors" style={invoiceType === t ? { borderColor: "var(--color-accent)", backgroundColor: "var(--color-accent-tint)", color: "var(--color-ink)" } : { borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}>
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
              {(invoiceType === "credit_note" || invoiceType === "debit_note") && (
                <div className="mt-4">
                  <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Against Invoice</label>
                  <select value={relatedInvoiceId} onChange={(e) => { setRelatedInvoiceId(e.target.value); const rel = gstOriginalInvoices.find((i) => i.id === e.target.value); if (rel) handleSelectCustomer(rel.customer_id); }} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                    <option value="">Select the original invoice…</option>
                    {gstOriginalInvoices.map((i) => (
                      <option key={i.id} value={i.id}>{i.invoice_number} — {i.profiles?.full_name ?? "Customer"} (₹{Number(i.total).toLocaleString("en-IN")})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {currentStepLabel === "Customer" && (
            <div>
              {(invoiceType === "credit_note" || invoiceType === "debit_note") ? (
                // A credit/debit note is issued against one specific
                // invoice — its customer is whoever that invoice was
                // billed to, not a fresh choice. Letting the wizard
                // re-pick or create a customer here would let the note
                // end up attached to someone who never received the
                // original invoice.
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-line)", backgroundColor: "var(--color-muted-tint)" }}>
                  <p className="text-xs font-semibold" style={{ color: "var(--color-ink-soft)" }}>Customer (from the selected invoice)</p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: "var(--color-ink)" }}>
                    {customers.find((c) => c.id === customerId)?.full_name ?? "—"}
                    {customers.find((c) => c.id === customerId)?.company ? ` — ${customers.find((c) => c.id === customerId)?.company}` : ""}
                  </p>
                  <p className="mt-2 text-xs" style={{ color: "var(--color-ink-soft)" }}>
                    To bill a different customer, go back to Step 1 and pick a different invoice under &quot;Against Invoice&quot;.
                  </p>
                </div>
              ) : (
              <>
              <div className="mb-3 flex gap-2">
                <button type="button" onClick={() => setCustomerMode("existing")} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={customerMode === "existing" ? { backgroundColor: "var(--color-accent)", color: "var(--color-ink)" } : { backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}>Existing Customer</button>
                <button type="button" onClick={() => setCustomerMode("new")} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={customerMode === "new" ? { backgroundColor: "var(--color-accent)", color: "var(--color-ink)" } : { backgroundColor: "var(--color-muted-tint)", color: "var(--color-muted-dark)" }}>+ Add New Customer</button>
              </div>

              {customerMode === "existing" ? (
                <select value={customerId} onChange={(e) => handleSelectCustomer(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                  <option value="">Select a customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name ?? "Unnamed"}{c.company ? ` — ${c.company}` : ""}</option>
                  ))}
                </select>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Customer Name<RequiredMark /></label>
                    <input value={newCustomer.fullName} onChange={(e) => setNewCustomer({ ...newCustomer, fullName: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                  </div>
                  <div>
                    <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Business Name</label>
                    <input value={newCustomer.company} onChange={(e) => setNewCustomer({ ...newCustomer, company: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                  </div>
                  <div>
                    <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Email<RequiredMark /></label>
                    <input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                  </div>
                  <div>
                    <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Mobile Number</label>
                    <input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                  </div>
                  <StateSelect value={newCustomer.state} onChange={(e) => setNewCustomer({ ...newCustomer, state: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                  <input placeholder="GSTIN (optional)" value={newCustomer.gstin} onChange={(e) => setNewCustomer({ ...newCustomer, gstin: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                  <input placeholder="PAN (optional)" value={newCustomer.panNumber} onChange={(e) => setNewCustomer({ ...newCustomer, panNumber: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                  <input placeholder="Billing Address" value={newCustomer.billingAddress} onChange={(e) => setNewCustomer({ ...newCustomer, billingAddress: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                  <input placeholder="Shipping Address (optional)" value={newCustomer.shippingAddress} onChange={(e) => setNewCustomer({ ...newCustomer, shippingAddress: e.target.value })} className={`${inputClass} sm:col-span-2`} style={{ borderColor: "var(--color-line)" }} />
                  <button type="button" onClick={handleCreateCustomer} disabled={creatingCustomer} className="sm:col-span-2 rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
                    {creatingCustomer ? "Adding…" : "Add Customer"}
                  </button>
                </div>
              )}

              {customerId && customerMode === "existing" && (
                <div className="mt-4 grid gap-3 rounded-xl border p-3 sm:grid-cols-2" style={{ borderColor: "var(--color-line)" }}>
                  <p className="text-xs font-semibold sm:col-span-2" style={{ color: "var(--color-ink-soft)" }}>Billing details for this invoice (editable):</p>
                  <input placeholder="GSTIN" value={custGstin} onChange={(e) => setCustGstin(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                  <input placeholder="PAN" value={custPan} onChange={(e) => setCustPan(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                  <StateSelect value={custState} onChange={(e) => setCustState(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                  <input placeholder="Billing Address" value={custBilling} onChange={(e) => setCustBilling(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                  <input placeholder="Shipping Address (optional)" value={custShipping} onChange={(e) => setCustShipping(e.target.value)} className={`${inputClass} sm:col-span-2`} style={{ borderColor: "var(--color-line)" }} />
                </div>
              )}
              </>
              )}
            </div>
          )}

          {currentStepLabel === "Details" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Invoice Number</label>
                <p className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}>Auto-generated on save</p>
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Invoice Date</label>
                <p className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--color-line)", color: "var(--color-ink-soft)" }}>{new Date().toLocaleDateString("en-IN")}</p>
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Place of Supply{taxable && <RequiredMark />}</label>
                <input required={taxable} value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Reverse Charge</label>
                <select value={reverseCharge ? "yes" : "no"} onChange={(e) => setReverseCharge(e.target.value === "yes")} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              {registrations.length > 0 && (
                <div>
                  <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>GST Registration</label>
                  <select value={gstRegistrationId} onChange={(e) => setGstRegistrationId(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                    <option value="">Default (Business Settings)</option>
                    {registrations.map((r) => (
                      <option key={r.id} value={r.id}>{r.label} — {r.gst_number}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>PDF Template</label>
                <select value={pdfTemplate} onChange={(e) => setPdfTemplate(e.target.value as "classic" | "modern")} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                  <option value="classic">Classic</option>
                  <option value="modern">Modern</option>
                </select>
              </div>
              {taxable && (
                <p className="text-xs sm:col-span-2" style={{ color: "var(--color-ink-soft)" }}>
                  {isIntraState ? "Same state as company — CGST + SGST will apply." : "Different state from company — IGST will apply."}
                </p>
              )}
            </div>
          )}

          {currentStepLabel === "Items" && (
            <div>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="rounded-xl border p-3" style={{ borderColor: "var(--color-line)" }}>
                    {catalog.length > 0 && (
                      <select value={item.catalogItemId} onChange={(e) => pickCatalogItem(i, e.target.value)} className={`${inputClass} mb-2`} style={{ borderColor: "var(--color-line)" }}>
                        <option value="">Pick from catalog (optional)…</option>
                        {catalog.map((c) => (
                          <option key={c.id} value={c.id}>{c.name} ({c.type === "product" ? "HSN" : "SAC"}: {c.hsn_sac_code ?? "—"}, {c.gst_rate}%)</option>
                        ))}
                      </select>
                    )}
                    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      <input required placeholder="Description" value={item.description} onChange={(e) => updateItem(i, { description: e.target.value })} className={`${inputClass} sm:col-span-3 lg:col-span-2`} style={{ borderColor: "var(--color-line)" }} />
                      <input placeholder={item.itemType === "product" ? "HSN Code" : "SAC Code"} value={item.hsnSacCode} onChange={(e) => updateItem(i, { hsnSacCode: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                      <input type="number" min="0" placeholder="Qty" value={item.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                      <input required type="number" min="0" placeholder="Rate ₹" value={item.rate} onChange={(e) => updateItem(i, { rate: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                      <input type="number" min="0" placeholder="Discount ₹" value={item.discount} onChange={(e) => updateItem(i, { discount: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                      {taxable ? (
                        <input type="number" min="0" max="28" placeholder="GST %" value={item.gstRate} onChange={(e) => updateItem(i, { gstRate: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                      ) : (
                        <div />
                      )}
                    </div>
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))} className="mt-2 flex items-center gap-1 text-xs font-medium" style={{ color: "#b42318" }}>
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setItems((prev) => [...prev, { ...EMPTY_ITEM }])} className="mt-3 text-sm font-medium" style={{ color: "var(--color-action-dark)" }}>
                + Add line item
              </button>
            </div>
          )}

          {currentStepLabel === "Charges & TDS" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Discount Type</label>
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value as typeof discountType)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                  <option value="">No overall discount</option>
                  <option value="flat">Flat Amount</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>
              {discountType && (
                <div>
                  <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Discount Value</label>
                  <input type="number" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                </div>
              )}
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Freight (₹)</label>
                <input type="number" min="0" value={freight} onChange={(e) => setFreight(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Packing (₹)</label>
                <input type="number" min="0" value={packing} onChange={(e) => setPacking(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Courier (₹)</label>
                <input type="number" min="0" value={courier} onChange={(e) => setCourier(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Other Charges (₹)</label>
                <input type="number" min="0" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>TDS Rate (%)</label>
                <select value={tdsRate} onChange={(e) => setTdsRate(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                  <option value="0">None</option>
                  <option value="2">2%</option>
                  <option value="10">10%</option>
                  <option value="custom">Custom…</option>
                </select>
                {tdsRate === "custom" && (
                  <input type="number" min="0" max="30" placeholder="Custom TDS %" onChange={(e) => setTdsRate(e.target.value)} className={`${inputClass} mt-2`} style={{ borderColor: "var(--color-line)" }} />
                )}
              </div>
            </div>
          )}

          {currentStepLabel === "Terms & Notes" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Payment Terms</label>
                <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                  <option value="Immediate">Immediate</option>
                  <option value="7 Days">7 Days</option>
                  <option value="15 Days">15 Days</option>
                  <option value="30 Days">30 Days</option>
                  <option value="Custom">Custom…</option>
                </select>
                {paymentTerms === "Custom" && (
                  <div className="mt-2 flex items-center gap-2">
                    <input type="number" min="0" value={customDays} onChange={(e) => setCustomDays(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
                    <span className="whitespace-nowrap text-xs" style={{ color: "var(--color-ink-soft)" }}>days</span>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Notes / Terms</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              </div>
            </div>
          )}

          {currentStepLabel === "Preview" && (
            <div>
              <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-line)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold" style={{ color: "var(--color-ink)" }}>{TYPE_LABEL[invoiceType]}</p>
                  <p className="text-sm" style={{ color: "var(--color-ink-soft)" }}>{selectedCustomer?.full_name ?? newCustomer.fullName ?? "—"}</p>
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  {lineItemDrafts.map((it, i) => (
                    <div key={i} className="flex justify-between" style={{ color: "var(--color-ink-soft)" }}>
                      <span>{it.description} × {it.quantity}</span>
                      <span>₹{(it.quantity * it.rate - it.discount).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1 border-t pt-3 text-sm" style={{ borderColor: "var(--color-line)" }}>
                  <div className="flex justify-between" style={{ color: "var(--color-ink-soft)" }}><span>Taxable Value</span><span>₹{totals.subtotal.toLocaleString("en-IN")}</span></div>
                  {totals.discountAmount > 0 && <div className="flex justify-between" style={{ color: "var(--color-ink-soft)" }}><span>Discount</span><span>− ₹{totals.discountAmount.toLocaleString("en-IN")}</span></div>}
                  {totals.cgstTotal > 0 && <div className="flex justify-between" style={{ color: "var(--color-ink-soft)" }}><span>CGST</span><span>₹{totals.cgstTotal.toLocaleString("en-IN")}</span></div>}
                  {totals.sgstTotal > 0 && <div className="flex justify-between" style={{ color: "var(--color-ink-soft)" }}><span>SGST</span><span>₹{totals.sgstTotal.toLocaleString("en-IN")}</span></div>}
                  {totals.igstTotal > 0 && <div className="flex justify-between" style={{ color: "var(--color-ink-soft)" }}><span>IGST</span><span>₹{totals.igstTotal.toLocaleString("en-IN")}</span></div>}
                  {totals.otherChargesTotal > 0 && <div className="flex justify-between" style={{ color: "var(--color-ink-soft)" }}><span>Other Charges</span><span>₹{totals.otherChargesTotal.toLocaleString("en-IN")}</span></div>}
                  <div className="flex justify-between text-base font-bold" style={{ color: "var(--color-ink)" }}><span>Invoice Value</span><span>₹{totals.invoiceValue.toLocaleString("en-IN")}</span></div>
                  {totals.tdsAmount > 0 && (
                    <>
                      <div className="flex justify-between" style={{ color: "var(--color-ink-soft)" }}><span>Less TDS</span><span>− ₹{totals.tdsAmount.toLocaleString("en-IN")}</span></div>
                      <div className="flex justify-between font-semibold" style={{ color: "var(--color-ink)" }}><span>Net Receivable</span><span>₹{totals.netReceivable.toLocaleString("en-IN")}</span></div>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" onClick={handlePreviewPdf} disabled={previewing} className="flex-1 rounded-full border py-2.5 text-sm font-semibold disabled:opacity-60" style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}>
                  {previewing ? "Building…" : "Preview PDF"}
                </button>
                <select value={recurringFrequency} onChange={(e) => setRecurringFrequency(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)", width: "auto" }}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <button type="button" onClick={handleCreateRecurring} disabled={savingRecurring} className="flex-1 rounded-full border py-2.5 text-sm font-semibold disabled:opacity-60" style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}>
                  {savingRecurring ? "Saving…" : "Save as Recurring"}
                </button>
                <button type="button" onClick={handleGenerate} disabled={generating} className="w-full rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
                  {generating ? "Saving…" : editingInvoiceId ? "Save Changes" : "Generate Invoice"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between border-t pt-4" style={{ borderColor: "var(--color-line)" }}>
            <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1} className="flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-40" style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}>
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            {step < activeStepLabels.length && (
              <button type="button" onClick={() => setStep((s) => s + 1)} className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: "var(--color-action)" }}>
                Next <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        </div>
      )}

      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(15,23,42,0.4)" }} onClick={() => setPayingInvoice(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-[var(--color-paper-raised)]" onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold" style={{ color: "var(--color-ink)" }}>Record Payment — {payingInvoice.invoice_number}</p>
            <p className="text-xs" style={{ color: "var(--color-ink-soft)" }}>Balance outstanding: ₹{balanceOf(payingInvoice).toLocaleString("en-IN")}</p>
            <div className="mt-3 space-y-2">
              <input type="number" min="0" placeholder="Amount Received (₹)" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
              <select value={payMode} onChange={(e) => setPayMode(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                <option>Cash</option>
                <option>Bank Transfer</option>
                <option>UPI</option>
                <option>Credit Card</option>
                <option>Cheque</option>
                <option>Razorpay</option>
              </select>
              <input placeholder="Transaction ID (optional)" value={payTxnId} onChange={(e) => setPayTxnId(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={handleRecordPayment} disabled={recordingPayment} className="flex-1 rounded-full py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
                {recordingPayment ? "Saving…" : "Record Payment"}
              </button>
              <button type="button" onClick={() => setPayingInvoice(null)} className="rounded-full border px-4 py-2 text-sm font-medium" style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {view === "invoices" && (
        <>
          <div className="mt-8 border-t pt-5" style={{ borderColor: "var(--color-line)" }}>
            <h3 className="text-base font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>Customer Statement</h3>
            <p className="mt-0.5 text-xs" style={{ color: "var(--color-ink-soft)" }}>
              A running account balance for one customer — every invoice raised (debit) and payment received (credit), in order, with the balance after each entry. Different from the invoice list below, which lists every invoice across all customers.
            </p>
            <div className="mt-3 max-w-xs">
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Select Customer</label>
              <select value={ledgerCustomerId} onChange={(e) => loadLedger(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                <option value="">Select a customer to view their statement…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.full_name ?? "Unnamed"}</option>
                ))}
              </select>
            </div>
          </div>
          {ledger && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <DateRangeFilter
                  from={ledgerDateFilter.from}
                  to={ledgerDateFilter.to}
                  onFromChange={ledgerDateFilter.setFrom}
                  onToChange={ledgerDateFilter.setTo}
                  onClear={ledgerDateFilter.clear}
                  active={ledgerDateFilter.active}
                />
                <ExportButton
                  filename="invoice-crm-ledger"
                  headers={["Date", "Entry", "Debit", "Credit", "Balance"]}
                  rows={ledgerDateFilter.filtered.map((e) => [
                    new Date(e.date).toLocaleDateString("en-IN"),
                    e.label,
                    e.debit > 0 ? e.debit : "",
                    e.credit > 0 ? e.credit : "",
                    e.balance,
                  ])}
                />
              </div>
              <TablePagination
                page={ledgerPagination.page}
                totalPages={ledgerPagination.totalPages}
                pageSize={ledgerPagination.pageSize}
                onPageChange={ledgerPagination.setPage}
                onPageSizeChange={ledgerPagination.setPageSize}
                start={ledgerPagination.start}
                end={ledgerPagination.end}
                total={ledgerPagination.total}
                itemLabel="entries"
              />
            <div className="mt-3 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
              <table className="dt-table w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
                    <th className="px-4 py-2 font-semibold" style={{ color: "var(--color-ink)" }}>#</th>
                    <th className="px-4 py-2 font-semibold" style={{ color: "var(--color-ink)" }}>Date</th>
                    <th className="px-4 py-2 font-semibold" style={{ color: "var(--color-ink)" }}>Entry</th>
                    <th className="px-4 py-2 font-semibold" style={{ color: "var(--color-ink)" }}>Debit</th>
                    <th className="px-4 py-2 font-semibold" style={{ color: "var(--color-ink)" }}>Credit</th>
                    <th className="px-4 py-2 font-semibold" style={{ color: "var(--color-ink)" }}>Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
                  {ledgerPagination.pageItems.map((e, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2" style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                      <td className="px-4 py-2" style={{ color: "var(--color-ink-soft)" }}>{new Date(e.date).toLocaleDateString("en-IN")}</td>
                      <td className="px-4 py-2" style={{ color: "var(--color-ink)" }}>{e.label}</td>
                      <td className="px-4 py-2" style={{ color: "var(--color-ink-soft)" }}>{e.debit > 0 ? `₹${e.debit.toLocaleString("en-IN")}` : "—"}</td>
                      <td className="px-4 py-2" style={{ color: "var(--color-ink-soft)" }}>{e.credit > 0 ? `₹${e.credit.toLocaleString("en-IN")}` : "—"}</td>
                      <td className="px-4 py-2 font-semibold" style={{ color: "var(--color-ink)" }}>₹{e.balance.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                  {ledgerDateFilter.filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
                        {ledger.length === 0 ? "No activity yet." : "No activity in this date range."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="px-4 py-3 text-sm font-semibold" style={{ color: "var(--color-ink)" }}>Total Outstanding: ₹{ledgerOutstanding.toLocaleString("en-IN")}</p>
            </div>
            </>
          )}

          <div className="mt-8 flex flex-wrap items-end justify-between gap-3 border-t pt-5" style={{ borderColor: "var(--color-line)" }}>
            <div>
              <h3 className="text-base font-bold" style={{ color: "var(--color-ink)", fontFamily: "var(--font-display)" }}>All Invoices</h3>
              <p className="mt-0.5 text-xs" style={{ color: "var(--color-ink-soft)" }}>
                Every invoice across every customer — download, share, and record payments here.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <DateRangeFilter
                from={invoiceDateFilter.from}
                to={invoiceDateFilter.to}
                onFromChange={invoiceDateFilter.setFrom}
                onToChange={invoiceDateFilter.setTo}
                onClear={invoiceDateFilter.clear}
                active={invoiceDateFilter.active}
              />
              <select
                value={invoiceStatusFilter}
                onChange={(e) => setInvoiceStatusFilter(e.target.value as InvoiceRow["status"] | "all")}
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
                style={{ borderColor: "var(--color-line)" }}
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <ExportButton
                filename="invoice-crm-invoices"
                headers={["Invoice", "Type", "Client", "Date", "Amount", "Balance", "Status"]}
                rows={invoiceDateFilter.filtered.map((inv) => [
                  inv.invoice_number,
                  TYPE_LABEL[inv.invoice_type] ?? "Invoice",
                  inv.profiles?.full_name ?? "—",
                  new Date(inv.created_at).toLocaleDateString("en-IN"),
                  Number(inv.total),
                  balanceOf(inv),
                  inv.status.replace("_", " "),
                ])}
              />
            </div>
          </div>

          <TablePagination
            page={invoicesPagination.page}
            totalPages={invoicesPagination.totalPages}
            pageSize={invoicesPagination.pageSize}
            onPageChange={invoicesPagination.setPage}
            onPageSizeChange={invoicesPagination.setPageSize}
            start={invoicesPagination.start}
            end={invoicesPagination.end}
            total={invoicesPagination.total}
            itemLabel="invoices"
          />

          <div className="mt-3 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
            <table className="dt-table w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>#</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Invoice</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Type</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Client</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Date</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Amount</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Balance</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Status</th>
                  <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}></th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
                {invoicesPagination.pageItems.map((inv, i) => {
                  const style = STATUS_STYLE[inv.status];
                  const balance = balanceOf(inv);
                  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/pay/${inv.id}` : `/pay/${inv.id}`;
                  const invCustomerPhone = customers.find((c) => c.id === inv.customer_id)?.phone ?? "";
                  const expanded = expandedInvoiceId === inv.id;
                  return (
                    <Fragment key={inv.id}>
                      <tr style={{ borderColor: "var(--color-line)" }}>
                        <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{inv.invoice_number}</td>
                        <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{TYPE_LABEL[inv.invoice_type] ?? "Invoice"}</td>
                        <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{inv.profiles?.full_name ?? "—"}</td>
                        <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{new Date(inv.created_at).toLocaleDateString("en-IN")}</td>
                        <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>₹{Number(inv.total).toLocaleString("en-IN")}</td>
                        <td className="px-4 py-3" style={{ color: balance > 0 ? "#b42318" : "var(--color-ink-soft)" }}>{balance > 0 ? `₹${balance.toLocaleString("en-IN")}` : "—"}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>{inv.status.replace("_", " ")}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <a href={`/api/invoices/${inv.id}/download`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline" style={{ color: "var(--color-action-dark)" }}>PDF / Print</a>
                            {inv.status === "draft" && (
                              <>
                                <button type="button" onClick={() => handleEditDraft(inv)} className="text-xs font-semibold underline" style={{ color: "var(--color-action-dark)" }}>Edit</button>
                                <button type="button" onClick={() => handleSend(inv.id)} className="text-xs font-semibold underline" style={{ color: "var(--color-action-dark)" }}>Send</button>
                              </>
                            )}
                            <button type="button" onClick={() => handleEmail(inv.id)} className="text-xs font-semibold underline" style={{ color: "var(--color-action-dark)" }}>Email</button>
                            {inv.status !== "paid" && inv.status !== "cancelled" && (
                              <button type="button" onClick={() => { setPayingInvoice(inv); setPayAmount(String(balance)); }} className="text-xs font-semibold underline" style={{ color: "#116a2c" }}>
                                Record Payment
                              </button>
                            )}
                            {invCustomerPhone && (
                              <a href={buildWhatsAppLink(invCustomerPhone, `Hi, here's your invoice ${inv.invoice_number} from ${SITE_NAME}: ${shareUrl}`)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold underline" style={{ color: "#116a2c" }}>
                                WhatsApp
                              </a>
                            )}
                            <button type="button" onClick={() => { navigator.clipboard.writeText(shareUrl); showSuccess("Link copied."); }} className="text-xs font-semibold underline" style={{ color: "var(--color-action-dark)" }}>
                              Copy Link
                            </button>
                            <button type="button" onClick={() => toggleExpand(inv, "attachments")} className="flex items-center gap-1 text-xs font-semibold underline" style={{ color: "var(--color-ink-soft)" }}>
                              <Paperclip className="h-3 w-3" /> Files
                            </button>
                            <button type="button" onClick={() => toggleExpand(inv, "history")} className="flex items-center gap-1 text-xs font-semibold underline" style={{ color: "var(--color-ink-soft)" }}>
                              <History className="h-3 w-3" /> History
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={9} className="px-4 py-4" style={{ backgroundColor: "var(--color-paper)" }}>
                            {expandedTab === "attachments" ? (
                              <div>
                                <div className="flex items-center gap-3">
                                  <label
                                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
                                    style={{ borderColor: "var(--color-line)", color: "var(--color-ink)", opacity: uploadingAttachment ? 0.6 : 1 }}
                                  >
                                    <Paperclip className="h-3.5 w-3.5" />
                                    {uploadingAttachment ? "Uploading…" : "Choose File"}
                                    <input
                                      type="file"
                                      disabled={uploadingAttachment}
                                      onChange={(e) => e.target.files?.[0] && handleUploadAttachment(inv.id, e.target.files[0])}
                                      className="hidden"
                                    />
                                  </label>
                                </div>
                                <ul className="mt-2 space-y-1">
                                  {attachments.map((a) => (
                                    <li key={a.id} className="text-sm">
                                      <a href={`/api/invoices/${inv.id}/attachments/${a.id}/download`} className="underline" style={{ color: "var(--color-action-dark)" }}>{a.file_name}</a>
                                    </li>
                                  ))}
                                  {attachments.length === 0 && <li className="text-sm" style={{ color: "var(--color-ink-soft)" }}>No attachments yet.</li>}
                                </ul>
                              </div>
                            ) : (
                              <ul className="space-y-1.5">
                                {history.map((h) => (
                                  <li key={h.id} className="text-sm" style={{ color: "var(--color-ink-soft)" }}>
                                    <span className="font-medium" style={{ color: "var(--color-ink)" }}>{h.event_type.replace("_", " ")}</span>
                                    {h.detail ? ` — ${h.detail}` : ""} · {h.profiles?.full_name ?? "System"} · {new Date(h.created_at).toLocaleString("en-IN")}
                                  </li>
                                ))}
                                {history.length === 0 && <li className="text-sm" style={{ color: "var(--color-ink-soft)" }}>No history yet.</li>}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {invoiceDateFilter.filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
                      {invoices.length === 0 ? "No billed invoices yet — generate one above." : "No invoices match this filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === "recurring" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <DateRangeFilter
              from={recurringDateFilter.from}
              to={recurringDateFilter.to}
              onFromChange={recurringDateFilter.setFrom}
              onToChange={recurringDateFilter.setTo}
              onClear={recurringDateFilter.clear}
              active={recurringDateFilter.active}
            />
            <ExportButton
              filename="invoice-crm-recurring"
              headers={["Customer", "Type", "Frequency", "Next Run"]}
              rows={recurringDateFilter.filtered.map((t) => [
                t.profiles?.full_name ?? "—",
                TYPE_LABEL[t.invoice_type as InvoiceType] ?? t.invoice_type,
                t.frequency,
                new Date(t.next_run_date).toLocaleDateString("en-IN"),
              ])}
            />
          </div>
          <TablePagination
            page={recurringPagination.page}
            totalPages={recurringPagination.totalPages}
            pageSize={recurringPagination.pageSize}
            onPageChange={recurringPagination.setPage}
            onPageSizeChange={recurringPagination.setPageSize}
            start={recurringPagination.start}
            end={recurringPagination.end}
            total={recurringPagination.total}
            itemLabel="templates"
          />
        <div className="mt-3 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
          <table className="dt-table w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
                <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>#</th>
                <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Customer</th>
                <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Type</th>
                <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Frequency</th>
                <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Next Run</th>
                <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}></th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
              {recurringPagination.pageItems.map((t, i) => (
                <tr key={t.id}>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{t.profiles?.full_name ?? "—"}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{TYPE_LABEL[t.invoice_type as InvoiceType] ?? t.invoice_type}</td>
                  <td className="px-4 py-3 capitalize" style={{ color: "var(--color-ink-soft)" }}>{t.frequency}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{new Date(t.next_run_date).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => handleRunTemplate(t.id)} disabled={runningTemplateId === t.id} className="flex items-center gap-1 text-xs font-semibold underline disabled:opacity-60" style={{ color: "var(--color-action-dark)" }}>
                      <Repeat className="h-3 w-3" /> {runningTemplateId === t.id ? "Running…" : "Run Now"}
                    </button>
                  </td>
                </tr>
              ))}
              {recurringDateFilter.filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
                    {recurringTemplates.length === 0
                      ? 'No recurring templates yet — build an invoice above, then hit "Save as Recurring" on the Preview step.'
                      : "No recurring templates in this date range."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
