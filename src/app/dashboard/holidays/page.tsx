"use client";

import { useEffect, useMemo, useState } from "react";
import { PartyPopper, Landmark, Building2, Plus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useActionMessage } from "@/lib/use-action-message";
import { ActionMessage } from "@/components/ActionMessage";
import { DashboardPageHero, HeroAction, HeroKpi } from "@/components/crm/DashboardPageHero";
import { LoadingBlock } from "@/components/Spinner";

type Holiday = {
  id: string;
  name: string;
  date: string;
  type: "national" | "festival" | "company";
  organization_id: string;
  organizations?: { name: string | null } | null;
};

const TYPE_STYLE: Record<Holiday["type"], { bg: string; fg: string }> = {
  national: { bg: "#fde2e2", fg: "#b42318" },
  festival: { bg: "#fff6d9", fg: "#8a6700" },
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
    if (!window.confirm(`Remove the holiday "${name}"? This can't be undone.`)) return;
    const res = await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    if (res.ok) {
      await load();
      showSuccess("Holiday removed.");
    } else {
      showError("Failed to remove holiday.");
    }
  }

  const inputClass = "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--color-action)]";

  const holidayStats = useMemo(() => {
    const national = holidays.filter((h) => h.type === "national").length;
    const festival = holidays.filter((h) => h.type === "festival").length;
    const company = holidays.filter((h) => h.type === "company").length;
    return { national, festival, company };
  }, [holidays]);

  const [typeFilter, setTypeFilter] = useState<Holiday["type"] | "all">("all");
  const filteredHolidays = useMemo(() => {
    return holidays.filter((h) => typeFilter === "all" || h.type === typeFilter);
  }, [holidays, typeFilter]);

  if (loading) {
    return <LoadingBlock />;
  }

  // Only a platform_admin's request ever returns more than one org's
  // holidays pooled together — the column is only worth showing once
  // it's actually ambiguous which org a row belongs to.
  const spansMultipleOrgs = new Set(holidays.map((h) => h.organization_id)).size > 1;

  return (
    <div>
      <DashboardPageHero
        title="Holiday Calendar"
        subtitle="National, festival, and company holidays for the year."
        action={
          isAdmin ? (
            <HeroAction icon={showForm ? undefined : Plus} onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "Add Holiday"}
            </HeroAction>
          ) : undefined
        }
      >
        <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <HeroKpi icon={Landmark} label="National" value={holidayStats.national} />
          <HeroKpi icon={PartyPopper} label="Festival" value={holidayStats.festival} />
          <HeroKpi icon={Building2} label="Company" value={holidayStats.company} />
        </div>
      </DashboardPageHero>

      <div className="mt-3">
        <ActionMessage message={message} />
      </div>

      {showForm && isAdmin && (
        <form onSubmit={handleAdd} className="mt-3 grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-3 dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <input required placeholder="Holiday name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} style={{ borderColor: "var(--color-line)" }} />
          <select value={type} onChange={(e) => setType(e.target.value as Holiday["type"])} className={inputClass} style={{ borderColor: "var(--color-line)" }}>
            <option value="company">Company Holiday</option>
            <option value="national">National Holiday</option>
            <option value="festival">Festival Holiday</option>
          </select>
          <button type="submit" disabled={submitting} className="sm:col-span-3 rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "var(--color-action)" }}>
            {submitting ? "Saving…" : "Add Holiday"}
          </button>
        </form>
      )}

      {holidays.length !== 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as Holiday["type"] | "all")}
            className="rounded-lg border px-2.5 py-1.5 text-sm outline-none"
            style={{ borderColor: "var(--color-line)", color: "var(--color-ink)" }}
          >
            <option value="all">All types</option>
            <option value="national">National</option>
            <option value="festival">Festival</option>
            <option value="company">Company</option>
          </select>
          {typeFilter !== "all" && (
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className="text-xs font-semibold"
              style={{ color: "var(--color-action-dark)" }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {holidays.length === 0 ? (
        <p className="mt-5 text-sm" style={{ color: "var(--color-ink-soft)" }}>No holidays added yet.</p>
      ) : filteredHolidays.length === 0 ? (
        <p className="mt-5 text-sm" style={{ color: "var(--color-ink-soft)" }}>No holidays match this filter.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-2xl border bg-white dark:bg-[var(--color-paper-raised)]" style={{ borderColor: "var(--color-line)" }}>
          <table className="dt-table w-full min-w-[480px]">
            <thead>
              <tr className="text-left">
                <th>#</th>
                <th>Name</th>
                <th>Date</th>
                <th>Type</th>
                {spansMultipleOrgs && <th>Organization</th>}
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filteredHolidays.map((h, i) => {
                const style = TYPE_STYLE[h.type];
                return (
                  <tr key={h.id}>
                    <td style={{ color: "var(--color-ink-soft)" }}>{i + 1}</td>
                    <td className="font-medium" style={{ color: "var(--color-ink)" }}>{h.name}</td>
                    <td style={{ color: "var(--color-ink-soft)" }}>
                      {new Date(h.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td>
                      <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: style.bg, color: style.fg }}>{h.type}</span>
                    </td>
                    {spansMultipleOrgs && <td style={{ color: "var(--color-ink-soft)" }}>{h.organizations?.name ?? "—"}</td>}
                    {isAdmin && (
                      <td>
                        <button type="button" onClick={() => handleDelete(h.id, h.name)} className="text-xs font-semibold" style={{ color: "#b42318" }}>
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
