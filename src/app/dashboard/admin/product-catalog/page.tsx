"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, Plus, Wrench } from "lucide-react";
import { useActionMessage } from "@/lib/use-action-message";
import { useConfirm } from "@/lib/use-confirm";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroAction, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { Modal } from "@/components/Modal";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { MultiSelect } from "@/components/MultiSelect";
import { SearchButton } from "@/components/SearchButton";

type CatalogItem = {
  id: string;
  type: "product" | "service";
  name: string;
  hsn_sac_code: string | null;
  gst_rate: number;
  unit: string;
  default_rate: number | null;
  description: string | null;
  organization_id: string;
  organizations?: { name: string | null } | null;
};

const EMPTY_FORM = { type: "service" as "product" | "service", name: "", hsnSacCode: "", gstRate: "18", unit: "Nos", defaultRate: "", description: "" };

export default function ProductCatalogPage() {
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { message, showSuccess, showError } = useActionMessage();
  const { confirm, confirmDialog } = useConfirm();

  async function load() {
    const res = await fetch("/api/product-service-master");
    if (res.ok) setItems((await res.json()).items ?? []);
  }

  useEffect(() => {
    const kickoff = setTimeout(load, 0);
    return () => clearTimeout(kickoff);
  }, []);

  function startEdit(item: CatalogItem) {
    setEditingId(item.id);
    setForm({
      type: item.type,
      name: item.name,
      hsnSacCode: item.hsn_sac_code ?? "",
      gstRate: String(item.gst_rate),
      unit: item.unit,
      defaultRate: item.default_rate != null ? String(item.default_rate) : "",
      description: item.description ?? "",
    });
    setShowForm(true);
  }

  function startNew() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      type: form.type,
      name: form.name,
      hsnSacCode: form.hsnSacCode || undefined,
      gstRate: Number(form.gstRate) || 0,
      unit: form.unit,
      defaultRate: form.defaultRate ? Number(form.defaultRate) : undefined,
      description: form.description || undefined,
    };
    const res = editingId
      ? await fetch(`/api/product-service-master/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/product-service-master", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) {
      setShowForm(false);
      setEditingId(null);
      await load();
      showSuccess(editingId ? "Item updated." : "Item added to catalog.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to save item.");
    }
  }

  async function handleRemove(id: string) {
    if (!(await confirm("Remove this item from the catalog? Past invoices that used it are unaffected.", { confirmLabel: "Remove", danger: true }))) return;
    const res = await fetch(`/api/product-service-master/${id}`, { method: "DELETE" });
    if (res.ok) {
      await load();
      showSuccess("Item removed.");
    } else {
      showError("Failed to remove item.");
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";
  const labelClass = "block text-xs font-medium mb-1";

  // Type is a status-like filter, so it applies on Search rather than
  // the instant an option is checked — draftTypeFilter is what the
  // MultiSelect is bound to, typeFilter is what actually filters.
  const [draftTypeFilter, setDraftTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const typeFilterDirty = draftTypeFilter.size !== typeFilter.size || [...draftTypeFilter].some((v) => !typeFilter.has(v));
  const typeFilteredItems = useMemo(() => {
    return (items ?? []).filter((item) => typeFilter.size === 0 || typeFilter.has(item.type));
  }, [items, typeFilter]);

  if (items === null) {
    return <LoadingBlock />;
  }

  // Only a platform_admin's request ever returns more than one org's
  // catalog pooled together — the column is only worth showing once
  // it's actually ambiguous which org an item belongs to.
  const spansMultipleOrgs = new Set(items.map((i) => i.organization_id)).size > 1;

  const productItems = items.filter((i) => i.type === "product");
  const serviceItems = items.filter((i) => i.type === "service");

  const columns: DataTableColumn<CatalogItem>[] = [
    { key: "name", header: "Name", render: (item) => <span className="font-medium" style={{ color: "var(--color-ink)" }}>{item.name}</span>, exportValue: (item) => item.name, sortValue: (item) => item.name },
    { key: "type", header: "Type", className: "w-[10%] whitespace-nowrap", render: (item) => <span className="capitalize">{item.type}</span>, exportValue: (item) => item.type, sortValue: (item) => item.type },
    { key: "hsnSac", header: "HSN/SAC", className: "w-[12%] whitespace-nowrap", render: (item) => item.hsn_sac_code ?? "—", exportValue: (item) => item.hsn_sac_code ?? "" },
    { key: "gst", header: "GST %", className: "w-[8%] whitespace-nowrap", render: (item) => `${item.gst_rate}%`, exportValue: (item) => item.gst_rate, sortValue: (item) => item.gst_rate },
    { key: "unit", header: "Unit", className: "w-[8%] whitespace-nowrap", render: (item) => item.unit, exportValue: (item) => item.unit },
    { key: "rate", header: "Rate", className: "w-[12%] whitespace-nowrap", render: (item) => (item.default_rate != null ? `₹${Number(item.default_rate).toLocaleString("en-IN")}` : "—"), exportValue: (item) => (item.default_rate != null ? Number(item.default_rate) : ""), sortValue: (item) => item.default_rate },
    ...(spansMultipleOrgs
      ? [{ key: "org", header: "Organization", render: (item: CatalogItem) => item.organizations?.name ?? "—", exportValue: (item: CatalogItem) => item.organizations?.name ?? "Unknown organization" } as DataTableColumn<CatalogItem>]
      : []),
    {
      key: "actions",
      header: "",
      render: (item) => (
        <div className="whitespace-nowrap">
          <button type="button" onClick={() => startEdit(item)} className="mr-3 text-xs font-semibold" style={{ color: "var(--color-action-dark)" }}>Edit</button>
          <button type="button" onClick={() => handleRemove(item.id)} className="text-xs font-semibold" style={{ color: "var(--color-danger)" }}>Remove</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <DashboardPageHero
        title="Invoice Item Catalog"
        subtitle={
          spansMultipleOrgs
            ? "Every organization's invoice item catalog, pooled here for platform-level support — each company still manages its own from its own Administration → Invoice Item Catalog page. Adding a new item here has no single company to attach it to; open a specific organization's own page to add one for them."
            : "Auto-fills HSN/SAC codes, GST rate, and unit when staff pick an item on an ad-hoc invoice line — separate from your public pricing pages. Editing a price here only changes the autofill default on new invoice lines; it never changes what a customer pays when buying a plan through checkout or Buy Plan for Customer."
        }
        action={
          spansMultipleOrgs ? undefined : (
            <HeroAction icon={showForm ? undefined : Plus} onClick={() => (showForm ? setShowForm(false) : startNew())}>
              {showForm ? "Cancel" : "Add Item"}
            </HeroAction>
          )
        }
      >
        <div className="relative mt-6 grid grid-cols-2 gap-4 sm:max-w-md">
          <HeroKpi icon={Package} label="Products" value={productItems.length} />
          <HeroKpi icon={Wrench} label="Services" value={serviceItems.length} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>
      {confirmDialog}

      {showForm && (
        <Modal title={editingId ? "Edit Item" : "Add Item"} onClose={() => setShowForm(false)} maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "product" | "service" })} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
                <option value="service">Service</option>
                <option value="product">Product</option>
              </select>
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>{form.type === "product" ? "HSN Code" : "SAC Code"}</label>
              <input value={form.hsnSacCode} onChange={(e) => setForm({ ...form, hsnSacCode: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} placeholder={form.type === "product" ? "e.g. 8443" : "e.g. 998213"} />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>GST Rate (%)</label>
              <input type="number" min="0" max="28" step="0.01" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Unit</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} placeholder="Nos / Hrs / Kg" />
            </div>
            <div>
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Default Rate (₹)</label>
              <input type="number" min="0" value={form.defaultRate} onChange={(e) => setForm({ ...form, defaultRate: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className={labelClass} style={{ color: "var(--color-ink-soft)" }}>Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className="rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
              {saving ? "Saving…" : editingId ? "Save Changes" : "Add Item"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-accent-tint)]"
              style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
            >
              Cancel
            </button>
          </div>
        </form>
        </Modal>
      )}

      <DataTable
        columns={columns}
        fixedLayout
        rows={typeFilteredItems}
        getRowKey={(item) => item.id}
        itemLabel="items"
        emptyMessage={items.length === 0 ? "No catalog items yet — add your first product or service above." : "No items match this filter."}
        filteredEmptyMessage="No items match this filter."
        search={{ placeholder: "Search name, HSN/SAC…", filter: (item, q) => `${item.name} ${item.hsn_sac_code ?? ""}`.toLowerCase().includes(q) }}
        exportFilename="product-catalog"
        toolbar={
          <>
            <MultiSelect
              options={[
                { value: "product", label: "Product" },
                { value: "service", label: "Service" },
              ]}
              selected={draftTypeFilter}
              onChange={setDraftTypeFilter}
              placeholder="All types"
            />
            <SearchButton onClick={() => setTypeFilter(draftTypeFilter)} dirty={typeFilterDirty} />
          </>
        }
      />
    </div>
  );
}
