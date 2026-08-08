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
import { DashboardPageHero, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";
import { usePagination } from "@/lib/use-pagination";
import { TablePagination } from "@/components/TablePagination";
import { ExportButton } from "@/components/ExportButton";

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
  const [staffName, setStaffName] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LeadStage | "all">("all");
  const [selectedState, setSelectedState] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { message, showSuccess, showError } = useActionMessage();

  async function reload(supabase: ReturnType<typeof createSupabaseBrowserClient>, name: string) {
    const { data } = await supabase.from("leads").select("*").eq("assigned_to", name).order("created_at", { ascending: false });
    setLeads((data as LeadRow[] | null) ?? []);
  }

  useEffect(() => {
    const kickoff = setTimeout(async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      const name = profile?.full_name ?? user.email ?? "";
      setStaffName(name);
      await reload(supabase, name);
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
    if (staffName) {
      const supabase = createSupabaseBrowserClient();
      await reload(supabase, staffName);
    }
    form.reset();
    setSelectedState("");
    setShowForm(false);
    showSuccess("Lead added.");
  }

  const leadStats = useMemo(() => {
    const won = leads.filter((l) => l.status === "won").length;
    const inProgress = leads.filter((l) => l.status === "contacted" || l.status === "in_progress").length;
    const fresh = leads.filter((l) => l.status === "new").length;
    return { total: leads.length, won, inProgress, fresh };
  }, [leads]);

  const [search, setSearch] = useState("");
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${l.name} ${l.email} ${l.phone} ${l.company ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [leads, statusFilter, search]);
  const { page, setPage, pageSize, setPageSize, pageItems: pagedLeads, totalPages, total, start, end } = usePagination(filteredLeads);

  if (loading) {
    return <LoadingBlock />;
  }

  return (
    <div>
      <DashboardPageHero title="My Leads" subtitle="Leads assigned to you — track them from first contact to close.">
        <div className="relative mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <HeroKpi icon={Users} label="Total" value={leadStats.total} />
          <HeroKpi icon={Sparkles} label="New" value={leadStats.fresh} />
          <HeroKpi icon={Clock} label="In Progress" value={leadStats.inProgress} />
          <HeroKpi icon={Trophy} label="Won" value={leadStats.won} />
        </div>
      </DashboardPageHero>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, company…"
            className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LeadStage | "all")}
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]"
            style={{ borderColor: "var(--color-line)" }}
          >
            <option value="all">All statuses</option>
            {Object.entries(LEAD_STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {(search.trim() || statusFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
              }}
              className="text-xs font-semibold"
              style={{ color: "var(--color-action-dark)" }}
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ExportButton
            filename="crm-leads"
            headers={["Name", "Company", "Contact", "Location", "Status"]}
            rows={filteredLeads.map((l) => [l.name, l.company || "", `${l.email} ${l.phone}`, [l.city, l.state].filter(Boolean).join(", "), LEAD_STAGE_LABELS[l.status]])}
          />
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            {showForm ? "Cancel" : "+ Add Lead"}
          </button>
        </div>
      </div>

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
          <button
            type="submit"
            disabled={submitting}
            className="sm:col-span-2 rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: "var(--color-action)" }}
          >
            {submitting ? "Saving…" : "Save Lead"}
          </button>
        </form>
      )}

      <TablePagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        start={start}
        end={end}
        total={total}
        itemLabel="leads"
      />

      <div className="mt-3 overflow-x-auto rounded-2xl border" style={{ borderColor: "var(--color-line)" }}>
        <table className="dt-table w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted-tint)" }}>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>#</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Name</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Company</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Contact</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Location</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}>Status</th>
              <th className="px-4 py-3 font-semibold" style={{ color: "var(--color-ink)" }}></th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: "var(--color-line)" }}>
            {pagedLeads.map((l, i) => {
              const style = STATUS_STYLE[l.status];
              return (
                <tr key={l.id} className="align-top" style={{ borderColor: "var(--color-line)" }}>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--color-ink)" }}>{l.name}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>{l.company || "—"}</td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
                    <div>{l.email}</div>
                    <div>{l.phone}</div>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--color-ink-soft)" }}>
                    {[l.city, l.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>
                      {LEAD_STAGE_LABELS[l.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <a
                      href={buildWhatsAppLink(l.phone, `Hi ${l.name.split(" ")[0]}, this is ${SITE_NAME} following up on your enquiry. How can we help you get started?`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ backgroundColor: "#d0f4db", color: "#116a2c" }}
                    >
                      WhatsApp
                    </a>
                  </td>
                </tr>
              );
            })}
            {filteredLeads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: "var(--color-ink-soft)" }}>
                  {leads.length === 0 ? "No leads assigned to you yet." : "No leads match this filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
