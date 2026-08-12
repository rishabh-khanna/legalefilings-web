"use client";

import { useEffect, useMemo, useState } from "react";
import { PartyPopper, Landmark, Building2, Plus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useActionMessage } from "@/lib/use-action-message";
import { useConfirm } from "@/lib/use-confirm";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroAction, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { Modal } from "@/components/Modal";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { MultiSelect } from "@/components/MultiSelect";
import { SearchButton } from "@/components/SearchButton";

type Holiday = {
  id: string;
  name: string;
  date: string;
  type: "national" | "festival" | "company";
  organization_id: string;
  organizations?: { name: string | null } | null;
  creator?: { full_name: string | null } | null;
};

const TYPE_STYLE: Record<Holiday["type"], { bg: string; fg: string }> = {
  national: { bg: "var(--color-danger-tint)", fg: "var(--color-danger)" },
  festival: { bg: "var(--color-action-tint)", fg: "var(--color-action-dark)" },
  company: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
};

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [type, setType] = useState<Holiday["type"]>("company");
  const [submitting, setSubmitting] = useState(false);
  const { message, showSuccess, showError } = useActionMessage();
  const { confirm, confirmDialog } = useConfirm();

  async function load() {
    const res = await fetch("/api/holidays");
    if (res.ok) setHolidays((await res.json()).holidays ?? []);
    setLoading(false);
  }

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).single();
        setIsAdmin(profile?.account_type === "admin");
      }
      await load();
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, date, type }),
    });
    setSubmitting(false);
    if (res.ok) {
      setName("");
      setDate("");
      setShowForm(false);
      await load();
      showSuccess("Holiday added.");
    } else {
      const data = await res.json().catch(() => null);
      showError(data?.error ?? "Failed to add holiday.");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!(await confirm(`Remove the holiday "${name}"? This can't be undone.`, { confirmLabel: "Remove", danger: true }))) return;
    const res = await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    if (res.ok) {
      await load();
      showSuccess("Holiday removed.");
    } else {
      showError("Failed to remove holiday.");
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  const holidaysByType = useMemo(() => {
    return {
      national: holidays.filter((h) => h.type === "national"),
      festival: holidays.filter((h) => h.type === "festival"),
      company: holidays.filter((h) => h.type === "company"),
    };
  }, [holidays]);


  const [draftTypeFilter, setDraftTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const typeFilterDirty = draftTypeFilter.size !== typeFilter.size || [...draftTypeFilter].some((v) => !typeFilter.has(v));
  const filteredHolidays = useMemo(() => {
    return holidays.filter((h) => typeFilter.size === 0 || typeFilter.has(h.type));
  }, [holidays, typeFilter]);

  if (loading) {
    return <LoadingBlock />;
  }

  // Only a platform_admin's request ever returns more than one org's
  // holidays pooled together — the column is only worth showing once
  // it's actually ambiguous which org a row belongs to.
  const spansMultipleOrgs = new Set(holidays.map((h) => h.organization_id)).size > 1;

  const columns: DataTableColumn<Holiday>[] = [
    { key: "name", header: "Name", render: (h) => <span className="font-medium" style={{ color: "var(--color-ink)" }}>{h.name}</span>, exportValue: (h) => h.name, sortValue: (h) => h.name },
    {
      key: "date",
      header: "Date",
      className: "w-[20%] whitespace-nowrap",
      render: (h) => new Date(h.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
      exportValue: (h) => h.date,
      sortValue: (h) => h.date,
    },
    {
      key: "type",
      header: "Type",
      className: "w-[12%] whitespace-nowrap",
      render: (h) => (
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: TYPE_STYLE[h.type].bg, color: TYPE_STYLE[h.type].fg }}>
          {h.type}
        </span>
      ),
      exportValue: (h) => h.type,
      sortValue: (h) => h.type,
    },
    { key: "createdBy", header: "Created By", className: "w-[12%] whitespace-nowrap", render: (h) => h.creator?.full_name ?? "—", exportValue: (h) => h.creator?.full_name ?? "", sortValue: (h) => h.creator?.full_name },
    ...(spansMultipleOrgs
      ? [{ key: "org", header: "Organization", render: (h: Holiday) => h.organizations?.name ?? "—", exportValue: (h: Holiday) => h.organizations?.name ?? "Unknown organization" } as DataTableColumn<Holiday>]
      : []),
    ...(isAdmin
      ? [{
          key: "actions",
          header: "Action",
          render: (h: Holiday) => (
            <button type="button" onClick={() => handleDelete(h.id, h.name)} className="text-xs font-semibold" style={{ color: "var(--color-danger)" }}>
              Remove
            </button>
          ),
        } as DataTableColumn<Holiday>]
      : []),
  ];

  return (
    <div>
      <DashboardPageHero
        title="Holiday Calendar"
        subtitle={
          spansMultipleOrgs
            ? "Every organization's holiday calendar, pooled here for platform-level support — each company still manages its own from its own Holiday Calendar page."
            : "National, festival, and company holidays for the year."
        }
        action={
          isAdmin && !spansMultipleOrgs ? (
            <HeroAction icon={showForm ? undefined : Plus} onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "Add Holiday"}
            </HeroAction>
          ) : undefined
        }
      >
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HeroKpi icon={Landmark} label="National" value={holidaysByType.national.length} />
          <HeroKpi icon={PartyPopper} label="Festival" value={holidaysByType.festival.length} />
          <HeroKpi icon={Building2} label="Company" value={holidaysByType.company.length} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>
      {confirmDialog}

      {isAdmin && spansMultipleOrgs && (
        <p className="mt-3 text-xs" style={{ color: "var(--color-ink-soft)" }}>
          Adding a new holiday here isn&apos;t available in this cross-org view — there&apos;s no single company to attach it to. Open a specific organization&apos;s own Holiday Calendar page to add one for them.
        </p>
      )}

      {showForm && isAdmin && !spansMultipleOrgs && (
        <Modal title="Add Holiday" onClose={() => setShowForm(false)}>
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-3">
          <input required placeholder="Holiday name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <select value={type} onChange={(e) => setType(e.target.value as Holiday["type"])} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
            <option value="company">Company Holiday</option>
            <option value="national">National Holiday</option>
            <option value="festival">Festival Holiday</option>
          </select>
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" disabled={submitting} className="rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
              {submitting ? "Saving…" : "Add Holiday"}
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
        rows={filteredHolidays}
        getRowKey={(h) => h.id}
        itemLabel="holidays"
        emptyMessage={holidays.length === 0 ? "No holidays added yet." : "No holidays match this filter."}
        filteredEmptyMessage="No holidays match this filter."
        search={{ placeholder: "Search holiday name…", filter: (h, q) => h.name.toLowerCase().includes(q) }}
        exportFilename="holidays"
        toolbar={
          <>
            <MultiSelect
              options={[
                { value: "national", label: "National" },
                { value: "festival", label: "Festival" },
                { value: "company", label: "Company" },
              ]}
              selected={draftTypeFilter}
              onChange={setDraftTypeFilter}
              placeholder="All types"
            />
            <SearchButton onClick={() => setTypeFilter(draftTypeFilter)} dirty={typeFilterDirty} />
            {typeFilter.size > 0 && (
              <button
                type="button"
                onClick={() => { setDraftTypeFilter(new Set()); setTypeFilter(new Set()); }}
                className="text-xs font-semibold"
                style={{ color: "var(--color-action-dark)" }}
              >
                Clear filters
              </button>
            )}
          </>
        }
      />
    </div>
  );
}
