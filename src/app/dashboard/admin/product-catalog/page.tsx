"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, Plus, Wrench } from "lucide-react";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroAction, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { usePagination } from "@/lib/use-pagination";
import { TablePagination } from "@/components/TablePagination";
import { ExportButton } from "@/components/ExportButton";

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
    if (!confirm("Remove this item from the catalog? Past invoices that used it are unaffected.")) return;
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

  const [typeFilter, setTypeFilter] = useState<"all" | "product" | "service">("all");
  const [search, setSearch] = useState("");
  const filteredItems = useMemo(() => {
    return (items ?? []).filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${item.name} ${item.hsn_sac_code ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, typeFilter, search]);

  const { page, setPage, pageSize, setPageSize, pageItems: pagedItems, totalPages, total, start, end } = usePagination(filteredItems);

  if (items === null) {
    return <LoadingBlock />;
  }

  // Only a platform_admin's request ever returns more than one org's
  // catalog pooled together — the column is only worth showing once
  // it's actually ambiguous which org an item belongs to.
  const spansMultipleOrgs = new Set(items.map((i) => i.organization_id)).size > 1;

  const productCount = items.filter((i) => i.type === "product").length;
  const serviceCount = items.filter((i) => i.type === "service").length;

  return (
    <div>
      <DashboardPageHero
        title="Invoice Item Catalog"
        subtitle="Auto-fills HSN/SAC codes, GST rate, and unit when staff pick an item on an ad-hoc invoice line — separate from your public pricing pages. Editing a price here only changes the autofill default on new invoice lines; it never changes what a customer pays when buying a plan through checkout or Buy Plan for Customer."
        action={
          <HeroAction icon={showForm ? undefined : Plus} onClick={() => (showForm ? setShowForm(false) : startNew())}>
            {showForm ? "Cancel" : "Add Item"}
          </HeroAction>
        }
      >
        <div className="relative mt-6 grid grid-cols-2 gap-4 sm:max-w-md">
          <HeroKpi icon={Package} label="Products" value={productCount} />
          <HeroKpi icon={Wrench} label="Services" value={serviceCount} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 rounded-2xl border bg-white p-5 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
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
          <button type="submit" disabled={saving} className="mt-4 rounded-full px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
            {saving ? "Saving…" : editingId ? "Save Changes" : "Add Item"}
          </button>
        </form>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, HSN/SAC…"
            className="w-full max-w-xs rounded-lg border px-3 py-1.5 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "all" | "product" | "service")}
            className="rounded-lg border px-2.5 py-1.5 text-sm outline-none"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
          >
            <option value="all">All types</option>
            <option value="product">Product</option>
            <option value="service">Service</option>
          </select>
          {(search.trim() || typeFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setTypeFilter("all");
              }}
              className="text-xs font-semibold"
              style={{ color: "var(--color-action-dark)" }}
            >
              Clear filters
            </button>
          )}
        </div>
        <ExportButton
          filename="product-catalog"
          headers={["Name", "Type", "HSN/SAC", "GST %", "Unit", "Rate", ...(spansMultipleOrgs ? ["Organization"] : [])]}
          rows={filteredItems.map((item) => [
            item.name,
            item.type,
            item.hsn_sac_code ?? "",
            item.gst_rate,
            item.unit,
            item.default_rate != null ? Number(item.default_rate) : "",
            ...(spansMultipleOrgs ? [item.organizations?.name ?? "Unknown organization"] : []),
          ])}
        />
      </div>

      <TablePagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        start={start}
        end={end}
        total={total}
        itemLabel="items"
      />

      <div className="mt-3 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
        <table className="dt-table w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>#</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Name</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Type</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>HSN/SAC</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>GST %</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Unit</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Rate</th>
              {spansMultipleOrgs && <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Organization</th>}
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {pagedItems.map((item, i) => (
              <tr key={item.id}>
                <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{item.name}</td>
                <td className="px-4 py-3 capitalize" style={{ color: "var(--color-ink-soft)" }}>{item.type}</td>
                <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{item.hsn_sac_code ?? "—"}</td>
                <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{item.gst_rate}%</td>
                <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{item.unit}</td>
                <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{item.default_rate != null ? `₹${Number(item.default_rate).toLocaleString("en-IN")}` : "—"}</td>
                {spansMultipleOrgs && <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{item.organizations?.name ?? "—"}</td>}
                <td className="px-4 py-3 whitespace-nowrap">
                  <button type="button" onClick={() => startEdit(item)} className="mr-3 text-xs font-semibold" style={{ color: "var(--color-action-dark)" }}>Edit</button>
                  <button type="button" onClick={() => handleRemove(item.id)} className="text-xs font-semibold" style={{ color: "#b42318" }}>Remove</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={spansMultipleOrgs ? 9 : 8} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>No catalog items yet — add your first product or service above.</td>
              </tr>
            )}
            {items.length !== 0 && filteredItems.length === 0 && (
              <tr>
                <td colSpan={spansMultipleOrgs ? 9 : 8} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>No items match this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
