"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, Sparkles, Trophy, Clock } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { StateSelect } from "@/components/StateSelect";
import { CitySelect } from "@/components/CitySelect";
import { LEAD_STAGE_LABELS, type LeadStage } from "@/lib/leads";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { SITE_NAME } from "@/config/site";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroAction, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { MultiSelect } from "@/components/MultiSelect";

type LeadRow = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string;
  city: string | null;
  state: string | null;
  status: LeadStage;
};

const STATUS_STYLE: Record<LeadStage, { bg: string; fg: string }> = {
  new: { bg: "var(--color-muted-tint)", fg: "var(--color-muted-dark)" },
  contacted: { bg: "#fff6d9", fg: "#8a6700" },
  in_progress: { bg: "#fff6d9", fg: "#8a6700" },
  won: { bg: "#d0f4db", fg: "#116a2c" },
  lost: { bg: "var(--color-paper)", fg: "var(--color-ink-soft)" },
};

export default function CrmPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [selectedState, setSelectedState] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { message, showSuccess, showError } = useActionMessage();

  // leads.assigned_to is a profiles FK (uuid), not a display name — see
  // supabase/migrations/20260829000000_leads_assigned_to_fk.sql. Filtering
  // by the caller's full_name (a leftover from the earlier text-column
  // era) never matched anything once that migration landed.
  async function reload(supabase: ReturnType<typeof createSupabaseBrowserClient>, id: string) {
    const { data } = await supabase.from("leads").select("*").eq("assigned_to", id).order("created_at", { ascending: false });
    setLeads((data as LeadRow[] | null) ?? []);
  }

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setStaffId(user.id);
      await reload(supabase, user.id);
      setLoading(false);
    }, 0);
    return () => clearTimeout(kickoff);
  }, []);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    // Goes through /api/leads (not a direct Supabase insert) so the
    // server can attach the caller's own organization_id — the browser
    // session doesn't know that, and leads.organization_id is NOT NULL.
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(data.get("name") ?? ""),
        company: String(data.get("company") ?? "") || undefined,
        email: String(data.get("email") ?? ""),
        phone: String(data.get("phone") ?? ""),
        city: String(data.get("city") ?? "") || undefined,
        state: String(data.get("state") ?? "") || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      showError("Failed to save lead — please try again.");
      return;
    }
    if (staffId) {
      const supabase = createSupabaseBrowserClient();
      await reload(supabase, staffId);
    }
    form.reset();
    setSelectedState("");
    setShowForm(false);
    showSuccess("Lead added.");
  }

  const leadsByStatus = useMemo(() => {
    return {
      won: leads.filter((l) => l.status === "won"),
      inProgress: leads.filter((l) => l.status === "contacted" || l.status === "in_progress"),
      fresh: leads.filter((l) => l.status === "new"),
    };
  }, [leads]);

  const statusFilteredLeads = useMemo(() => {
    return leads.filter((l) => statusFilter.size === 0 || statusFilter.has(l.status));
  }, [leads, statusFilter]);

  if (loading) {
    return <LoadingBlock />;
  }

  const columns: DataTableColumn<LeadRow>[] = [
    { key: "name", header: "Name", render: (l) => <span className="font-medium" style={{ color: "var(--color-ink)" }}>{l.name}</span>, exportValue: (l) => l.name, sortValue: (l) => l.name },
    { key: "company", header: "Company", render: (l) => l.company || "—", exportValue: (l) => l.company || "", sortValue: (l) => l.company },
    { key: "contact", header: "Contact", render: (l) => <><div>{l.email}</div><div>{l.phone}</div></>, exportValue: (l) => `${l.email} ${l.phone}`, sortValue: (l) => l.email },
    { key: "location", header: "Location", render: (l) => [l.city, l.state].filter(Boolean).join(", ") || "—", exportValue: (l) => [l.city, l.state].filter(Boolean).join(", ") },
    {
      key: "status",
      header: "Status",
      className: "w-[14%] whitespace-nowrap",
      render: (l) => (
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: STATUS_STYLE[l.status].bg, color: STATUS_STYLE[l.status].fg }}>
          {LEAD_STAGE_LABELS[l.status]}
        </span>
      ),
      exportValue: (l) => LEAD_STAGE_LABELS[l.status],
      sortValue: (l) => LEAD_STAGE_LABELS[l.status],
    },
    {
      key: "actions",
      header: "",
      className: "whitespace-nowrap",
      render: (l) => (
        <a
          href={buildWhatsAppLink(l.phone, `Hi ${l.name.split(" ")[0]}, this is ${SITE_NAME} following up on your enquiry. How can we help you get started?`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: "#d0f4db", color: "#116a2c" }}
        >
          WhatsApp
        </a>
      ),
    },
  ];

  return (
    <div>
      <DashboardPageHero
        title="My Leads"
        subtitle="Leads assigned to you — track them from first contact to close."
        action={
          <HeroAction onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ Add Lead"}
          </HeroAction>
        }
      >
        <div className="relative mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <HeroKpi icon={Users} label="Total" value={leads.length} />
          <HeroKpi icon={Sparkles} label="New" value={leadsByStatus.fresh.length} />
          <HeroKpi icon={Clock} label="In Progress" value={leadsByStatus.inProgress.length} />
          <HeroKpi icon={Trophy} label="Won" value={leadsByStatus.won.length} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      {showForm && (
        <form
          onSubmit={handleAdd}
          className="mt-5 grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2 dark:bg-[var(--color-paper-raised)]"
          style={{ borderColor: "var(--color-line)" }}
        >
          <input name="name" required placeholder="Name" className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]" style={{ borderColor: "var(--color-line)" }} />
          <input name="company" placeholder="Company" className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]" style={{ borderColor: "var(--color-line)" }} />
          <input name="email" type="email" required placeholder="Email" className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]" style={{ borderColor: "var(--color-line)" }} />
          <input name="phone" placeholder="Phone" className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]" style={{ borderColor: "var(--color-line)" }} />
          <StateSelect
            name="state"
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
          />
          <CitySelect
            key={selectedState}
            name="city"
            state={selectedState}
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
          />
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "var(--color-action)" }}
            >
              {submitting ? "Saving…" : "Save Lead"}
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
      )}

      <DataTable
        columns={columns}
        fixedLayout
        rows={statusFilteredLeads}
        getRowKey={(l) => l.id}
        itemLabel="leads"
        emptyMessage={leads.length === 0 ? "No leads assigned to you yet." : "No leads match this filter."}
        filteredEmptyMessage="No leads match this filter."
        search={{ placeholder: "Search name, email, phone, company…", filter: (l, q) => `${l.name} ${l.email} ${l.phone} ${l.company ?? ""}`.toLowerCase().includes(q) }}
        exportFilename="crm-leads"
        minWidth={560}
        toolbar={
          <MultiSelect
            options={Object.entries(LEAD_STAGE_LABELS).map(([value, label]) => ({ value, label }))}
            selected={statusFilter}
            onChange={setStatusFilter}
            placeholder="All statuses"
          />
        }
      />
    </div>
  );
}
